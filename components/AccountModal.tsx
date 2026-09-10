import React, { useState, useEffect } from 'react';
import { 
  X, 
  User as UserIcon, 
  KeyRound, 
  ShieldCheck, 
  Building2, 
  Save, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  Send, 
  LogOut, 
  Lock, 
  Phone, 
  Briefcase, 
  Mail, 
  Calendar, 
  Clock, 
  Hotel,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { changeCurrentUserPassword, sendUserPasswordReset } from '../services/adminAuthService';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  hotelsList?: { id: string; name: string }[];
}

type TabType = 'profile' | 'security' | 'access';

const AccountModal: React.FC<AccountModalProps> = ({ isOpen, onClose, hotelsList = [] }) => {
  const { 
    currentUser, 
    userRole, 
    allowedHotels, 
    userProfile, 
    updateProfileData, 
    logout 
  } = useAuth();

  const [activeTab, setActiveTab] = useState<TabType>('profile');

  // Profile Form State
  const [displayName, setDisplayName] = useState('');
  const [title, setTitle] = useState('');
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState('');
  const [notes, setNotes] = useState('');

  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Security / Password State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Reset Email State
  const [sendingReset, setSendingReset] = useState(false);
  const [resetSentSuccess, setResetSentSuccess] = useState<string | null>(null);

  // Sync profile data when opened or userProfile changes
  useEffect(() => {
    if (isOpen) {
      setDisplayName(userProfile?.displayName || currentUser?.displayName || '');
      setTitle(userProfile?.title || (userRole === 'superadmin' ? 'Super Admin' : 'Ön Büro Müdürü'));
      setPhone(userProfile?.phone || '');
      setDepartment(userProfile?.department || 'Ön Büro');
      setNotes(userProfile?.notes || '');
      
      // Clear notices
      setProfileSuccess(null);
      setProfileError(null);
      setPasswordSuccess(null);
      setPasswordError(null);
      setResetSentSuccess(null);
      
      // Clear sensitive fields
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
  }, [isOpen, userProfile, currentUser, userRole]);

  if (!isOpen || !currentUser) return null;

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileSuccess(null);
    setProfileError(null);

    try {
      await updateProfileData({
        displayName: displayName.trim(),
        title: title.trim(),
        phone: phone.trim(),
        department: department.trim(),
        notes: notes.trim(),
      });
      setProfileSuccess('Profil bilgileriniz başarıyla güncellendi.');
      setTimeout(() => setProfileSuccess(null), 4000);
    } catch (err: any) {
      console.error('Error saving profile', err);
      setProfileError(err.message || 'Profil güncellenirken bir hata oluştu.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordSuccess(null);
    setPasswordError(null);

    if (!currentPassword) {
      setPasswordError('Lütfen mevcut şifrenizi giriniz.');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('Yeni şifre en az 6 karakter uzunluğunda olmalıdır.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Yeni şifreler eşleşmiyor. Lütfen kontrol ediniz.');
      return;
    }

    if (currentPassword === newPassword) {
      setPasswordError('Yeni şifreniz mevcut şifrenizle aynı olamaz.');
      return;
    }

    setSavingPassword(true);

    try {
      await changeCurrentUserPassword(currentUser, currentPassword, newPassword);
      setPasswordSuccess('Şifreniz başarıyla değiştirildi! Bir sonraki girişinizde bu şifreyi kullanabilirsiniz.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(null), 5000);
    } catch (err: any) {
      console.error('Password change error', err);
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setPasswordError('Mevcut şifrenizi hatalı girdiniz. Lütfen tekrar deneyiniz.');
      } else if (err.code === 'auth/weak-password') {
        setPasswordError('Şifre çok zayıf. En az 6 karakterli harf ve rakam kombinasyonu belirleyiniz.');
      } else if (err.code === 'auth/requires-recent-login') {
        setPasswordError('Güvenlik nedeniyle oturumunuz eski olduğundan şifre değiştirilemedi. Lütfen çıkış yapıp tekrar giriş yaptıktan sonra deneyiniz.');
      } else {
        setPasswordError(err.message || 'Şifre güncellenirken bir hata oluştu.');
      }
    } finally {
      setSavingPassword(false);
    }
  };

  const handleSendResetEmail = async () => {
    if (!currentUser.email) return;
    setSendingReset(true);
    setResetSentSuccess(null);
    setPasswordError(null);

    try {
      await sendUserPasswordReset(currentUser.email);
      setResetSentSuccess(`"${currentUser.email}" adresinize şifre sıfırlama bağlantısı gönderildi. E-postanızı kontrol ediniz.`);
    } catch (err: any) {
      console.error('Reset email error', err);
      setPasswordError('Şifre sıfırlama e-postası gönderilirken bir hata oluştu.');
    } finally {
      setSendingReset(false);
    }
  };

  const handleLogout = async () => {
    if (window.confirm('Oturumunuz kapatılacaktır, onaylıyor musunuz?')) {
      onClose();
      await logout();
    }
  };

  // Format dates
  const creationDate = currentUser.metadata.creationTime 
    ? new Date(currentUser.metadata.creationTime).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : 'Bilinmiyor';

  const lastLoginDate = currentUser.metadata.lastSignInTime 
    ? new Date(currentUser.metadata.lastSignInTime).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : 'Bilinmiyor';

  // Resolved hotels for editors
  const userAssignedHotels = hotelsList.filter(h => allowedHotels.includes(h.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header with User Info Card */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500 to-indigo-700 text-white flex items-center justify-center font-black text-lg shadow-inner ring-2 ring-white/20">
              {displayName ? displayName.charAt(0).toUpperCase() : currentUser.email?.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold tracking-tight text-white">
                  {displayName || currentUser.email?.split('@')[0]}
                </h3>
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                  userRole === 'superadmin'
                    ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                    : 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/30'
                }`}>
                  {userRole === 'superadmin' ? 'Superadmin' : 'Ön Büro Müdürü'}
                </span>
              </div>
              <p className="text-xs text-slate-300 flex items-center gap-1.5 mt-0.5">
                <Mail size={12} className="text-slate-400" />
                <span>{currentUser.email}</span>
                {title && <span className="text-indigo-300 ml-1">• {title}</span>}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 gap-2">
          <button
            onClick={() => setActiveTab('profile')}
            className={`py-3 px-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'profile'
                ? 'border-indigo-600 text-indigo-700 bg-white shadow-sm -mb-[1px] rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <UserIcon size={14} />
            <span>Profil Bilgileri</span>
          </button>

          <button
            onClick={() => setActiveTab('security')}
            className={`py-3 px-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'security'
                ? 'border-indigo-600 text-indigo-700 bg-white shadow-sm -mb-[1px] rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <KeyRound size={14} />
            <span>Güvenlik & Şifre</span>
          </button>

          <button
            onClick={() => setActiveTab('access')}
            className={`py-3 px-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'access'
                ? 'border-indigo-600 text-indigo-700 bg-white shadow-sm -mb-[1px] rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShieldCheck size={14} />
            <span>Erişim & Yetkilerim</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* TAB 1: PROFILE MANAGEMENT */}
          {activeTab === 'profile' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div>
                <h4 className="text-sm font-bold text-slate-900">Kişisel Bilgiler</h4>
                <p className="text-xs text-slate-500">
                  Sistem içi profil ve iletişim bilgilerinizi buradan güncelleyebilirsiniz.
                </p>
              </div>

              {profileSuccess && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-800 font-semibold animate-in fade-in">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  <span>{profileSuccess}</span>
                </div>
              )}

              {profileError && (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-800 font-semibold animate-in fade-in">
                  <AlertCircle size={16} className="text-red-600 shrink-0" />
                  <span>{profileError}</span>
                </div>
              )}

              <form onSubmit={handleProfileSave} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Display Name */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Ad Soyad
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Örn: Ahmet Yılmaz"
                        className="w-full text-xs border border-slate-300 rounded-xl px-3.5 py-2.5 pl-9 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                      />
                      <UserIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    </div>
                  </div>

                  {/* Email (Readonly) */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Kayıtlı E-posta Adresi
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        disabled
                        value={currentUser.email || ''}
                        className="w-full text-xs border border-slate-200 bg-slate-100 text-slate-500 rounded-xl px-3.5 py-2.5 pl-9 cursor-not-allowed font-medium"
                      />
                      <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">E-posta adresi Super Admin tarafından tanımlanır.</p>
                  </div>

                  {/* Title / Position */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Ünvan / Pozisyon
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Örn: Ön Büro Müdürü"
                        className="w-full text-xs border border-slate-300 rounded-xl px-3.5 py-2.5 pl-9 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                      />
                      <Briefcase size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    </div>
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Telefon Numarası
                    </label>
                    <div className="relative">
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="Örn: 0532 123 45 67"
                        className="w-full text-xs border border-slate-300 rounded-xl px-3.5 py-2.5 pl-9 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                      />
                      <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    </div>
                  </div>

                  {/* Department */}
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Departman / Birim
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        placeholder="Örn: Ön Büro, Gelir Yönetimi, Genel Yönetim"
                        className="w-full text-xs border border-slate-300 rounded-xl px-3.5 py-2.5 pl-9 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                      />
                      <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    </div>
                  </div>

                  {/* Notes / Bio */}
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Profil Notları / Açıklama
                    </label>
                    <textarea
                      rows={2}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Gerektiğinde yöneticilerin görebileceği notlar..."
                      className="w-full text-xs border border-slate-300 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="py-2.5 px-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-colors disabled:opacity-50"
                  >
                    {savingProfile ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    {savingProfile ? 'Kaydediliyor...' : 'Profilimi Güncelle'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 2: SECURITY & PASSWORD */}
          {activeTab === 'security' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div>
                <h4 className="text-sm font-bold text-slate-900">Güvenlik ve Şifre Yönetimi</h4>
                <p className="text-xs text-slate-500">
                  Giriş şifrenizi dilediğiniz an değiştirebilir veya e-posta sıfırlama bağlantısı isteyebilirsiniz.
                </p>
              </div>

              {passwordSuccess && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-800 font-semibold animate-in fade-in">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  <span>{passwordSuccess}</span>
                </div>
              )}

              {passwordError && (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-800 font-semibold animate-in fade-in">
                  <AlertCircle size={16} className="text-red-600 shrink-0" />
                  <span>{passwordError}</span>
                </div>
              )}

              {resetSentSuccess && (
                <div className="p-3.5 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center gap-2 text-xs text-indigo-800 font-semibold animate-in fade-in">
                  <Send size={16} className="text-indigo-600 shrink-0" />
                  <span>{resetSentSuccess}</span>
                </div>
              )}

              {/* Password Change Form */}
              <form onSubmit={handlePasswordChange} className="space-y-4 bg-slate-50/70 p-4 rounded-xl border border-slate-200">
                <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5 pb-1 border-b border-slate-200">
                  <Lock size={14} className="text-indigo-600" />
                  <span>Şifre Güncelleme Formu</span>
                </div>

                {/* Current Password */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Mevcut Şifreniz
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrent ? 'text' : 'password'}
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full text-xs border border-slate-300 rounded-xl px-3.5 py-2.5 pr-10 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrent(!showCurrent)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showCurrent ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* New Password */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Yeni Şifre
                    </label>
                    <div className="relative">
                      <input
                        type={showNew ? 'text' : 'password'}
                        required
                        minLength={6}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="En az 6 karakter"
                        className="w-full text-xs border border-slate-300 rounded-xl px-3.5 py-2.5 pr-10 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNew(!showNew)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Yeni Şifre (Tekrar)
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirm ? 'text' : 'password'}
                        required
                        minLength={6}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Yeni şifreyi doğrulayın"
                        className="w-full text-xs border border-slate-300 rounded-xl px-3.5 py-2.5 pr-10 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm(!showConfirm)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-slate-500">
                    * Şifreniz en az 6 karakter olmalıdır.
                  </span>
                  <button
                    type="submit"
                    disabled={savingPassword}
                    className="py-2.5 px-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-colors disabled:opacity-50"
                  >
                    {savingPassword ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
                    {savingPassword ? 'Güncelleniyor...' : 'Şifremi Değiştir'}
                  </button>
                </div>
              </form>

              {/* Password Reset via Email Option */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h5 className="text-xs font-bold text-slate-800">Şifrenizi Hatırlamıyor musunuz?</h5>
                    <p className="text-[11px] text-slate-500">
                      Kayıtlı e-posta adresinize tek tıkla güvenli şifre sıfırlama bağlantısı gönderebilirsiniz.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSendResetEmail}
                    disabled={sendingReset}
                    className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50 shrink-0"
                  >
                    {sendingReset ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                    <span>Sıfırlama Linki Gönder</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ACCESS & PERMISSIONS */}
          {activeTab === 'access' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div>
                <h4 className="text-sm font-bold text-slate-900">Erişim Yetkileri & Oturum Geçmişi</h4>
                <p className="text-xs text-slate-500">
                  Hesabınıza tanımlanmış rol, otel erişim izinleri ve oturum bilgilerini inceleyin.
                </p>
              </div>

              {/* Role Card */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white flex items-start gap-3">
                <div className={`p-2.5 rounded-xl ${
                  userRole === 'superadmin' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  <ShieldCheck size={20} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-bold text-slate-900">
                      {userRole === 'superadmin' ? 'Superadmin (Tam Yetkili)' : 'Ön Büro Müdürü (Kısıtlı Editör)'}
                    </h5>
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono font-bold">
                      {userRole}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    {userRole === 'superadmin'
                      ? 'Tüm otel içeriklerini, veritabanı ayarlarını, AI Mimar modellerini ve kullanıcı hesaplarını düzenleme yetkisine sahipsiniz.'
                      : 'Yalnızca yetkilendirildiğiniz otellerin içerik ağaçlarını ve verilerini görüntüleyip düzenleyebilirsiniz. Sistem ayarları kısıtlıdır.'}
                  </p>
                </div>
              </div>

              {/* Allowed Hotels List */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Hotel size={14} className="text-indigo-600" />
                    <span>Erişim İzni Olan Oteller</span>
                  </h5>
                  <span className="text-[11px] text-slate-500 font-semibold">
                    {userRole === 'superadmin' ? 'Tüm Oteller' : `${userAssignedHotels.length} Otel Atanmış`}
                  </span>
                </div>

                {userRole === 'superadmin' ? (
                  <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-center gap-2">
                    <Sparkles size={14} className="text-amber-600 shrink-0" />
                    <span>Superadmin olarak sistemdeki mevcut ve gelecekte oluşturulacak tüm otellere sınırsız erişiminiz bulunmaktadır.</span>
                  </div>
                ) : userAssignedHotels.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {userAssignedHotels.map(h => (
                      <div key={h.id} className="p-2.5 rounded-lg border border-slate-100 bg-slate-50 flex items-center gap-2 text-xs">
                        <Building2 size={14} className="text-slate-400 shrink-0" />
                        <span className="font-bold text-slate-800 truncate">{h.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono ml-auto">({h.id})</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500 text-center">
                    Henüz hesabınıza özel bir otel atanmamıştır. Lütfen Super Admin ile iletişime geçiniz.
                  </div>
                )}
              </div>

              {/* Session Meta */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2 text-xs text-slate-600">
                <h5 className="font-bold text-slate-800 flex items-center gap-1.5 text-xs mb-2">
                  <Clock size={13} className="text-slate-500" />
                  <span>Hesap & Oturum Bilgileri</span>
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="p-2.5 bg-white rounded-lg border border-slate-200/80">
                    <span className="text-[11px] text-slate-400 block">Hesap Oluşturulma:</span>
                    <span className="font-semibold text-slate-700">{creationDate}</span>
                  </div>
                  <div className="p-2.5 bg-white rounded-lg border border-slate-200/80">
                    <span className="text-[11px] text-slate-400 block">Son Oturum Açma:</span>
                    <span className="font-semibold text-slate-700">{lastLoginDate}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={handleLogout}
            className="text-xs font-bold text-red-600 hover:text-red-800 hover:bg-red-50 py-2 px-3 rounded-xl transition-colors flex items-center gap-1.5"
          >
            <LogOut size={14} />
            <span>Oturumu Kapat</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="py-2 px-4 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-colors"
          >
            Kapat
          </button>
        </div>

      </div>
    </div>
  );
};

export default AccountModal;
