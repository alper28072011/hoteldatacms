import React, { useState, useEffect } from 'react';
import { 
  signInWithEmailAndPassword, 
  sendPasswordResetEmail 
} from 'firebase/auth';
import { auth } from '../firebaseConfig';
import { checkUserAuthorization } from '../services/firestoreService';
import { useAuth } from '../contexts/AuthContext';
import { 
  Lock, 
  Mail, 
  Loader2, 
  Building2, 
  Eye, 
  EyeOff, 
  KeyRound, 
  ShieldCheck, 
  AlertCircle,
  ArrowRight,
  HelpCircle,
  CheckCircle2,
  X
} from 'lucide-react';

const Login: React.FC = () => {
  const { authError, clearAuthError } = useAuth();

  // Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Forgot Password Dialog
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null);

  // Sync authError from context
  useEffect(() => {
    if (authError) {
      setError(authError);
    }
  }, [authError]);

  // Handle Login with Email & Password
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setError('Lütfen kurumsal e-posta adresinizi giriniz.');
      return;
    }
    if (!password) {
      setError('Lütfen şifrenizi giriniz.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);
    if (clearAuthError) clearAuthError();

    try {
      // 1. Authorization check in Firestore
      const authCheck = await checkUserAuthorization(cleanEmail);
      if (!authCheck.isAuthorized) {
        setError(
          `"${cleanEmail}" adresi sistemde yetkilendirilmemiştir. Otel Veri Yönetim Sistemi'ne yalnızca Super Admin tarafından tanımlanan Ön Büro Müdürleri ve yöneticiler erişebilir. Lütfen sistem yöneticiniz ile iletişime geçiniz.`
        );
        setLoading(false);
        return;
      }

      // 2. Firebase Auth sign in
      await signInWithEmailAndPassword(auth, cleanEmail, password);
    } catch (err: any) {
      console.error("Login error", err);
      if (
        err.code === 'auth/wrong-password' || 
        err.code === 'auth/invalid-credential' ||
        err.code === 'auth/user-not-found'
      ) {
        setError('E-posta adresiniz veya şifreniz hatalı. Lütfen bilgilerinizi kontrol ediniz.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Lütfen geçerli bir e-posta formatı giriniz.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Çok fazla hatalı giriş denemesi yapıldı. Güvenlik nedeniyle hesabınız geçici olarak kilitlendi. Lütfen birkaç dakika sonra tekrar deneyiniz veya şifrenizi sıfırlayınız.');
      } else {
        setError('Giriş yapılırken bir hata oluştu: ' + (err.message || 'Bilinmeyen hata'));
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle Forgot Password / Password Reset Email
  const handleSendPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = forgotEmail.trim().toLowerCase();

    if (!cleanEmail) {
      setForgotError('Lütfen kurumsal e-posta adresinizi giriniz.');
      return;
    }

    setForgotLoading(true);
    setForgotError(null);
    setForgotSuccess(null);

    try {
      // 1. Check if authorized
      const authCheck = await checkUserAuthorization(cleanEmail);
      if (!authCheck.isAuthorized) {
        setForgotError(`"${cleanEmail}" adresi sistemde tanımlı bir kullanıcıya ait değildir. Lütfen Super Admin ile iletişime geçiniz.`);
        setForgotLoading(false);
        return;
      }

      // 2. Send Firebase password reset email
      await sendPasswordResetEmail(auth, cleanEmail);
      setForgotSuccess(`Şifre sıfırlama bağlantısı "${cleanEmail}" adresine gönderildi. Gelen e-postadaki bağlantıya tıklayarak yeni şifrenizi belirleyebilirsiniz.`);
    } catch (err: any) {
      console.error("Reset error", err);
      if (err.code === 'auth/user-not-found') {
        setForgotError('Bu e-posta adresi için kayıtlı bir kullanıcı bulunamadı.');
      } else if (err.code === 'auth/invalid-email') {
        setForgotError('Lütfen geçerli bir e-posta formatı giriniz.');
      } else {
        setForgotError('Şifre sıfırlama e-postası gönderilemedi: ' + (err.message || 'Bilinmeyen hata'));
      }
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden font-sans">
      
      {/* Subtle Background Accents */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header / Brand */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center z-10 px-4">
        <div className="inline-flex items-center justify-center p-3.5 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-xl mb-4">
          <Building2 className="h-10 w-10 text-indigo-400" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Otel Veri Yönetim Sistemi
        </h2>
        <p className="mt-2 text-sm text-slate-300 font-medium">
          Ön Büro & Çoklu Tesis Yönetim Portalı
        </p>
      </div>

      {/* Main Card */}
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10 px-4">
        <div className="bg-white/95 backdrop-blur-xl py-8 px-6 sm:px-10 shadow-2xl rounded-3xl border border-white/60 space-y-5">
          
          {/* Section Heading */}
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
                <Lock size={16} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Güvenli Giriş</h3>
                <p className="text-[11px] text-slate-500 font-medium">E-posta ve şifreniz ile oturum açın</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
              <ShieldCheck size={12} /> Yetkili Erişim
            </span>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3.5 bg-red-50/90 border border-red-200 rounded-2xl flex items-start gap-2.5 text-xs text-red-800 font-medium leading-relaxed animate-in fade-in duration-200">
              <AlertCircle size={16} className="text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1">{error}</div>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="p-3.5 bg-emerald-50/90 border border-emerald-200 rounded-2xl flex items-start gap-2.5 text-xs text-emerald-800 font-medium leading-relaxed animate-in fade-in duration-200">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1">{success}</div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handlePasswordLogin} className="space-y-4">
            {/* Email Field */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Kurumsal E-posta Adresi
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail size={16} />
                </div>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="onburo@otel.com"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white transition-all font-medium"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Şifre
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setForgotEmail(email);
                    setForgotError(null);
                    setForgotSuccess(null);
                    setShowForgotPassword(true);
                  }}
                  className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
                >
                  Şifremi Unuttum?
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <KeyRound size={16} />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white transition-all font-medium font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:bg-indigo-400 text-white text-sm font-bold rounded-xl shadow-md hover:shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Giriş Yapılıyor...</span>
                  </>
                ) : (
                  <>
                    <span>Giriş Yap</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Info Notice regarding Super Admin role definition */}
          <div className="p-3 bg-slate-50 border border-slate-200/70 rounded-xl space-y-1 text-slate-600 text-[11px] leading-relaxed">
            <div className="flex items-center gap-1.5 font-bold text-slate-800">
              <HelpCircle size={13} className="text-indigo-600 shrink-0" />
              <span>Hesap ve Şifre Bilgilendirmesi</span>
            </div>
            <p>
              Kullanıcı hesapları ve ilk giriş şifreleri sistem <span className="font-semibold text-slate-800">Super Admin</span>'i tarafından tanımlanır. Giriş yaptıktan sonra şifrenizi sağ üst profil menüsünden dilediğiniz zaman değiştirebilirsiniz.
            </p>
          </div>

        </div>

        {/* Footer info */}
        <div className="text-center mt-6 text-xs text-slate-400 font-medium">
          Hotel Data CMS &copy; {new Date().getFullYear()} &bull; Güvenli Otel Bilgi Yönetimi
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden p-6 space-y-4">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 text-indigo-700 rounded-lg">
                  <KeyRound size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Şifremi Sıfırla</h4>
                  <p className="text-[11px] text-slate-500">Kayıtlı e-posta adresinize sıfırlama bağlantısı gönderilir</p>
                </div>
              </div>
              <button
                onClick={() => setShowForgotPassword(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>

            {forgotError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
                {forgotError}
              </div>
            )}

            {forgotSuccess && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2 text-xs text-emerald-800 font-medium">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                <span>{forgotSuccess}</span>
              </div>
            )}

            {!forgotSuccess && (
              <form onSubmit={handleSendPasswordReset} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Sistemde Kayıtlı E-posta Adresiniz
                  </label>
                  <input
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="onburo@otel.com"
                    className="w-full text-sm border border-slate-300 rounded-xl px-3.5 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(false)}
                    className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
                  >
                    Vazgeç
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    {forgotLoading ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                    Sıfırlama Bağlantısı Gönder
                  </button>
                </div>
              </form>
            )}

            {forgotSuccess && (
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(false)}
                  className="py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm"
                >
                  Giriş Ekranına Dön
                </button>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
};

export default Login;
