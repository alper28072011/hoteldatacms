<?php
/**
 * Gemini ara katmanı (proxy)
 *
 * Tarayıcı Gemini'ye doğrudan bağlanmaz; isteği buraya gönderir. Bu dosya:
 *   1. Firebase oturum jetonunu (ID token) doğrular,
 *   2. kullanıcının CMS'te tanımlı ve Gemini kullanmaya yetkili olduğunu
 *      Firestore'dan kontrol eder,
 *   3. isteği gerçek API anahtarını ekleyerek Google'a iletir.
 *
 * Gerçek anahtar hiçbir zaman tarayıcıya gitmez. Anahtar şu sırayla aranır:
 *   - GEMINI_API_KEY ortam değişkeni
 *   - public_html'in bir üstündeki klasörde: hoteldatacms-secrets.php
 *   - bu klasörde: secrets.php (.htaccess ile dışarıya kapalı)
 * secrets.php içeriği:  <?php return ['GEMINI_API_KEY' => '...'];
 */

declare(strict_types=1);

const FIREBASE_PROJECT_ID = 'hotel-data-cms';
const OWNER_EMAIL = 'alper28072011@gmail.com';
const MAX_BODY_BYTES = 8 * 1024 * 1024;           // 8 MB
const AUTH_CACHE_SECONDS = 300;                    // yetki kontrolü önbelleği
const CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
const ALLOWED_ORIGINS = ['https://cms.corbit.tr'];

header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

function fail(int $code, string $message): void {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => ['code' => $code, 'message' => $message]], JSON_UNESCAPED_UNICODE);
    exit;
}

// ---------- CORS: yalnız kendi sitemiz ----------
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '') {
    if (!in_array($origin, ALLOWED_ORIGINS, true)) fail(403, 'Bu kaynaktan erişime izin verilmiyor.');
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
}
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    header('Access-Control-Allow-Methods: POST');
    header('Access-Control-Allow-Headers: content-type, x-goog-api-key, x-goog-api-client');
    header('Access-Control-Max-Age: 600');
    http_response_code(204);
    exit;
}
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') fail(405, 'Yalnız POST kabul edilir.');

// ---------- Hedef yol: yalnız izin verilen Gemini uçları ----------
$path = $_GET['p'] ?? ($_SERVER['PATH_INFO'] ?? '');
$path = '/' . ltrim((string)$path, '/');
if (!preg_match('#^/v1beta/models/[A-Za-z0-9.\-]{1,80}:(generateContent|streamGenerateContent|countTokens)$#', $path)) {
    fail(400, 'Geçersiz istek yolu.');
}

// ---------- Anahtar ----------
function load_api_key(): string {
    $env = getenv('GEMINI_API_KEY');
    if (is_string($env) && $env !== '') return $env;
    $candidates = [dirname(__DIR__, 2) . '/hoteldatacms-secrets.php', __DIR__ . '/secrets.php'];
    foreach ($candidates as $file) {
        if (is_file($file)) {
            $cfg = include $file;
            if (is_array($cfg) && !empty($cfg['GEMINI_API_KEY'])) return (string)$cfg['GEMINI_API_KEY'];
        }
    }
    return '';
}
$apiKey = load_api_key();
if ($apiKey === '') fail(500, 'Sunucuda Gemini anahtarı tanımlı değil.');

// ---------- HTTP yardımcısı ----------
function http_get(string $url, array $headers = []): array {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_HEADER => true,
    ]);
    $raw = curl_exec($ch);
    if ($raw === false) { curl_close($ch); return [0, '', '']; }
    $status = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $hsize = (int)curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    curl_close($ch);
    return [$status, substr($raw, 0, $hsize), substr($raw, $hsize)];
}

function cache_dir(): string {
    $dir = sys_get_temp_dir() . '/hoteldatacms_' . substr(hash('sha256', __DIR__), 0, 12);
    if (!is_dir($dir)) @mkdir($dir, 0700, true);
    return $dir;
}

// ---------- Firebase ID token doğrulama ----------
function b64url_decode(string $s): string {
    $s = strtr($s, '-_', '+/');
    return (string)base64_decode($s . str_repeat('=', (4 - strlen($s) % 4) % 4), true);
}

function google_certs(bool $force = false): array {
    $file = cache_dir() . '/certs.json';
    if (!$force && is_file($file)) {
        $cached = json_decode((string)file_get_contents($file), true);
        if (is_array($cached) && ($cached['exp'] ?? 0) > time()) return $cached['certs'];
    }
    [$status, $headers, $body] = http_get(CERTS_URL);
    $certs = json_decode($body, true);
    if ($status !== 200 || !is_array($certs)) fail(503, 'Oturum doğrulama anahtarları alınamadı.');
    $maxAge = 3600;
    if (preg_match('/max-age=(\d+)/i', $headers, $m)) $maxAge = (int)$m[1];
    @file_put_contents($file, json_encode(['exp' => time() + $maxAge, 'certs' => $certs]), LOCK_EX);
    return $certs;
}

function verify_id_token(string $jwt): array {
    $parts = explode('.', $jwt);
    if (count($parts) !== 3) fail(401, 'Geçersiz oturum.');
    [$h64, $p64, $s64] = $parts;
    $header = json_decode(b64url_decode($h64), true);
    $payload = json_decode(b64url_decode($p64), true);
    $sig = b64url_decode($s64);
    if (!is_array($header) || !is_array($payload) || ($header['alg'] ?? '') !== 'RS256' || empty($header['kid'])) {
        fail(401, 'Geçersiz oturum.');
    }
    $certs = google_certs();
    if (!isset($certs[$header['kid']])) $certs = google_certs(true);
    if (!isset($certs[$header['kid']])) fail(401, 'Geçersiz oturum.');
    $ok = openssl_verify("$h64.$p64", $sig, $certs[$header['kid']], OPENSSL_ALGO_SHA256);
    if ($ok !== 1) fail(401, 'Geçersiz oturum.');

    $now = time();
    $skew = 300;
    if (($payload['aud'] ?? '') !== FIREBASE_PROJECT_ID
        || ($payload['iss'] ?? '') !== 'https://securetoken.google.com/' . FIREBASE_PROJECT_ID
        || empty($payload['sub'])
        || ($payload['exp'] ?? 0) < $now
        || ($payload['iat'] ?? PHP_INT_MAX) > $now + $skew
        || ($payload['auth_time'] ?? PHP_INT_MAX) > $now + $skew
        || empty($payload['email'])) {
        fail(401, 'Oturum süresi dolmuş veya geçersiz.');
    }
    return $payload;
}

// ---------- Yetki: Firestore'dan rol ve Gemini izinleri ----------
function firestore_get(string $docPath, string $idToken): ?array {
    $url = 'https://firestore.googleapis.com/v1/projects/' . FIREBASE_PROJECT_ID . '/databases/(default)/documents/' . $docPath;
    [$status, , $body] = http_get($url, ['Authorization: Bearer ' . $idToken]);
    if ($status === 404) return null;
    if ($status !== 200) fail(403, 'Yetki bilgisi okunamadı.');
    $doc = json_decode($body, true);
    return is_array($doc) ? ($doc['fields'] ?? []) : null;
}

function is_allowed(array $claims, string $idToken): bool {
    $email = strtolower(trim((string)$claims['email']));
    $cacheFile = cache_dir() . '/auth_' . hash('sha256', $claims['sub'] . '|' . $email) . '.json';
    if (is_file($cacheFile) && filemtime($cacheFile) > time() - AUTH_CACHE_SECONDS) {
        $c = json_decode((string)file_get_contents($cacheFile), true);
        if (is_array($c) && isset($c['allowed'])) return (bool)$c['allowed'];
    }

    $roleDoc = firestore_get('user_roles/' . rawurlencode($email), $idToken);
    $isOwner = $email === OWNER_EMAIL;
    if ($roleDoc === null && !$isOwner) {
        $allowed = false;
    } else {
        $role = $isOwner ? 'superadmin' : ($roleDoc['role']['stringValue'] ?? 'editor');
        if ($role === 'superadmin') {
            $allowed = true;
        } else {
            $settings = firestore_get('system_settings/gemini', $idToken);
            $roles = ['superadmin', 'editor'];
            if ($settings && isset($settings['allowedRoles']['arrayValue'])) {
                $roles = array_map(fn($v) => $v['stringValue'] ?? '', $settings['allowedRoles']['arrayValue']['values'] ?? []);
            }
            $allowed = in_array($role, $roles, true);
        }
    }
    @file_put_contents($cacheFile, json_encode(['allowed' => $allowed]), LOCK_EX);
    return $allowed;
}

$idToken = trim((string)($_SERVER['HTTP_X_GOOG_API_KEY'] ?? ''));
if ($idToken === '' && preg_match('/^Bearer\s+(.+)$/i', (string)($_SERVER['HTTP_AUTHORIZATION'] ?? ''), $m)) {
    $idToken = trim($m[1]);
}
if ($idToken === '') fail(401, 'Oturum bulunamadı. Lütfen yeniden giriş yapın.');
$claims = verify_id_token($idToken);
if (!is_allowed($claims, $idToken)) fail(403, 'Gemini kullanma yetkiniz yok.');

// ---------- İsteği ilet ----------
$contentLength = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
if ($contentLength > MAX_BODY_BYTES) fail(413, 'İstek çok büyük.');
$body = file_get_contents('php://input', false, null, 0, MAX_BODY_BYTES + 1);
if ($body === false || strlen($body) > MAX_BODY_BYTES) fail(413, 'İstek çok büyük.');
if (json_decode($body) === null) fail(400, 'Geçersiz JSON.');

$isStream = str_ends_with($path, ':streamGenerateContent');
$target = 'https://generativelanguage.googleapis.com' . $path . ($isStream ? '?alt=sse' : '');

$ch = curl_init($target);
$statusSent = false;
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $body,
    CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'x-goog-api-key: ' . $apiKey],
    CURLOPT_TIMEOUT => 300,
    CURLOPT_HEADERFUNCTION => function ($ch, $line) use (&$statusSent) {
        if (!$statusSent && preg_match('#^HTTP/\S+\s+(\d{3})#', $line, $m)) {
            http_response_code((int)$m[1]);
        } elseif (stripos($line, 'content-type:') === 0) {
            header(trim($line));
        }
        return strlen($line);
    },
    CURLOPT_WRITEFUNCTION => function ($ch, $chunk) use (&$statusSent) {
        $statusSent = true;
        echo $chunk;
        if ($chunk !== '') { @ob_flush(); flush(); }
        return strlen($chunk);
    },
]);
if ($isStream) {
    header('X-Accel-Buffering: no');
    while (ob_get_level() > 0) ob_end_flush();
}
$ok = curl_exec($ch);
if ($ok === false && !$statusSent) {
    curl_close($ch);
    fail(502, 'Gemini servisine ulaşılamadı.');
}
curl_close($ch);
