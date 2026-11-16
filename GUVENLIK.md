# Güvenlik ve yayın adımları

Bu sürümde üç değişiklik var:

1. **Firestore kuralları** (`firestore.rules`): giriş yapmamış kimse veri okuyamaz ya da yazamaz. Giriş yapmış ama `user_roles` içinde kaydı olmayan biri de hiçbir şey göremez. Editör tüm otelleri okur ama yalnız yetkili olduğu otelleri yazar.
2. **Gemini ara katmanı** (`public/api/gemini.php`): tarayıcı Gemini'ye doğrudan bağlanmaz. Ara katman oturumu ve yetkiyi doğrular, gerçek anahtarı sunucuda ekler. Anahtar artık JavaScript dosyasında, veritabanında ya da tarayıcıda bulunmaz.
3. **Site başlıkları** (`public/.htaccess`): HTTPS zorunlu, CSP, iframe'e gömme yasağı, gizli dosyalara erişim yasağı ve `/comparison` gibi adreslerin yenilendiğinde açılması.

## Yayın sırası

### 1. Eski Gemini anahtarlarını iptal et
Google AI Studio veya Google Cloud Console → API anahtarları:
- `AIzaSyDQcZ…` ile başlayan anahtarı **sil** (GitHub'da ve canlı sitede açıktaydı).
- `system_settings/gemini` belgesindeki `AQ.Ab8R…` ile başlayan anahtarı **sil**.
- Yeni bir anahtar oluştur. "API kısıtlamaları" bölümünde yalnız **Generative Language API** seçili olsun. Anahtar sunucuda kullanılacağı için web sitesi (referrer) kısıtlaması koyma.

### 2. Firestore kurallarını yayınla
Firebase Console → hotel-data-cms → Firestore Database → **Kurallar**:
- `firestore.rules` dosyasının içeriğini yapıştır.
- "Kurallar Oyun Alanı"nda dene: oturumsuz `get /hotels/x` → **reddedilmeli**.
- **Yayınla**.

Kurallar eski sürümle de uyumludur, yani bu adım tek başına hemen yapılabilir.
CLI ile: `npx firebase-tools login`, ardından `npx firebase-tools deploy --only firestore:rules --project hotel-data-cms`.

### 3. Sunucuya anahtarı koy
Hostinger → Dosya Yöneticisi. `public_html` klasörünün **bir üstündeki** klasörde `hoteldatacms-secrets.php` adlı bir dosya oluştur:

```php
<?php return ['GEMINI_API_KEY' => 'YENİ_ANAHTAR'];
```

Bu dosya web'den erişilemeyen bir yerde durduğu için güvenlidir. Bu klasöre dosya yazamıyorsan aynı içeriği `public_html/api/secrets.php` olarak koy; `.htaccess` dosyası bu dosyayı dışarıya kapatır.
PHP sürümü 8.0 veya üstü olmalı (Hostinger → Gelişmiş → PHP Yapılandırması).

### 4. Yeni sürümü yükle
```bash
npm ci
npm run build
```
`dist/` klasörünün **içindekileri** (`.htaccess`, `api/`, `assets/`, `index.html`) `public_html` klasörüne yükle. Gizli dosyaları gösterme seçeneğini aç ki `.htaccess` dosyaları da gitsin. Eski `assets/index-*.js` dosyalarını sil, çünkü eski anahtarı içeriyorlar.

### 5. Kontrol
- `https://cms.corbit.tr` ile giriş yap; AI Mimar, çeviri ve sohbet çalışmalı.
- Süper admin olarak Ayarlar → **Kaydet**'e bir kez bas. Bu işlem veritabanındaki eski `apiKey` alanını siler.
- Oturumsuz kontrol (bu istek 403 dönmeli):
  `curl "https://firestore.googleapis.com/v1/projects/hotel-data-cms/databases/(default)/documents/hotels"`

## Kurallar
- `vite.config.ts` içine `define` ile **hiçbir anahtar koyma**. Oraya konan her değer yayınlanan JS dosyasına gömülür.
- `VITE_` ile başlayan ortam değişkenleri de tarayıcıya gider; gizli değer için kullanılmaz.
- Yeni bir Firestore koleksiyonu eklersen `firestore.rules` dosyasına da ekle. Kurallarda tanımlanmayan her yol kapalıdır.
