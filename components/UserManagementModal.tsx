import React, { useState, useEffect } from 'react';
import { 
  X, 
  Users, 
  Save, 
  Shield, 
  Loader2, 
  Hotel, 
  Trash2, 
  KeyRound, 
  Eye, 
  EyeOff, 
  Sparkles, 
  Building2, 
  Copy, 
  Check, 
  Send, 
  CheckCircle2, 
  AlertCircle,
  Share2,
  Lock
} from 'lucide-react';
import { getAllUserRoles, deleteUserRole } from '../services/firestoreService';
import { 
  adminCreateUserAccount, 
  sendUserPasswordReset, 
  generateRandomPassword 
} from '../services/adminAuthService';

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  hotelsList: { id: string; name: string }[];
}

interface UserRoleItem {
  email: string;
  role: 'superadmin' | 'editor';
  allowedHotels: string[];
}

interface CreatedCredentialsSummary {
  email: string;
  password?: string;
  role: string;
  hotels: string[];
}

const UserManagementModal: React.FC<UserManagementModalProps> = ({ isOpen, onClose, hotelsList }) => {
  const [userRoles, setUserRoles] = useState<UserRoleItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingEmail, setDeletingEmail] = useState<string | null>(null);
  const [resettingEmail, setResettingEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form State
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'superadmin' | 'editor'>('editor');
  const [selectedHotels, setSelectedHotels] = useState<string[]>([]);
  const [isEditing, setIsEditing] = useState(false);

  // Created credentials modal/summary state
  const [createdSummary, setCreatedSummary] = useState<CreatedCredentialsSummary | null>(null);
  const [copiedSummary, setCopiedSummary] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await getAllUserRoles();
      const sorted = [...data].sort((a, b) => a.email.localeCompare(b.email));
      setUserRoles(sorted);
    } catch (e) {
      console.error("Failed to load user roles", e);
      setError("Kullanıcı rolleri yüklenirken bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
      resetForm();
    }
  }, [isOpen]);

  const resetForm = () => {
    setEmailInput('');
    setPasswordInput('');
    setShowPassword(false);
    setSelectedRole('editor');
    setSelectedHotels([]);
    setIsEditing(false);
    setError(null);
    setSuccess(null);
  };

  const handleGeneratePassword = () => {
    const generated = generateRandomPassword();
    setPasswordInput(generated);
    setShowPassword(true);
  };

  const handleToggleHotel = (hotelId: string) => {
    setSelectedHotels(prev => 
      prev.includes(hotelId)
        ? prev.filter(id => id !== hotelId)
        : [...prev, hotelId]
    );
  };

  const handleEditUser = (user: UserRoleItem) => {
    setEmailInput(user.email);
    setPasswordInput(''); // Leave blank when editing existing user
    setSelectedRole(user.role);
    setSelectedHotels(user.allowedHotels);
    setIsEditing(true);
    setCreatedSummary(null);
    setError(null);
    setSuccess(null);
  };

  const handleDeleteUser = async (emailToDelete: string) => {
    if (!window.confirm(`"${emailToDelete}" kullanıcısının yetkisini silmek istediğinize emin misiniz? Bu kullanıcı artık sisteme giriş yapamayacaktır.`)) {
      return;
    }

    setDeletingEmail(emailToDelete);
    setError(null);
    setSuccess(null);

    try {
      await deleteUserRole(emailToDelete);
      setSuccess(`"${emailToDelete}" kullanıcısının erişim yetkisi kaldırıldı.`);
      if (emailInput.toLowerCase().trim() === emailToDelete.toLowerCase().trim()) {
        resetForm();
      }
      await fetchUsers();
    } catch (err: any) {
      console.error(err);
      setError('Kullanıcı silinirken hata oluştu: ' + (err.message || 'Bilinmeyen hata'));
    } finally {
      setDeletingEmail(null);
    }
  };

  const handleSendResetEmailToUser = async (userEmail: string) => {
    setResettingEmail(userEmail);
    setError(null);
    setSuccess(null);
    try {
      await sendUserPasswordReset(userEmail);
      setSuccess(`"${userEmail}" kullanıcısına şifre sıfırlama bağlantısı gönderildi.`);
    } catch (err: any) {
      console.error(err);
      setError('Şifre sıfırlama e-postası gönderilemedi: ' + (err.message || 'Bilinmeyen hata'));
    } finally {
      setResettingEmail(null);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput) {
      setError('Lütfen geçerli bir e-posta adresi giriniz.');
      return;
    }

    const emailClean = emailInput.trim().toLowerCase();
    if (emailClean === 'alper28072011@gmail.com') {
      setError('Bu superadmin kullanıcısının yetkileri değiştirilemez.');
      return;
    }

    // When creating a new user, a password is required
    if (!isEditing && (!passwordInput || passwordInput.length < 6)) {
      setError('Lütfen yeni kullanıcı için en az 6 karakterli bir şifre giriniz veya "Şifre Üret" butonuna basınız.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    setCreatedSummary(null);

    try {
      const activePassword = passwordInput.trim() || generateRandomPassword();

      const result = await adminCreateUserAccount(
        emailClean,
        activePassword,
        selectedRole,
        selectedRole === 'superadmin' ? [] : selectedHotels
      );

      const hotelNames = selectedHotels.map(id => hotelsList.find(h => h.id === id)?.name || id);

      if (isEditing) {
        setSuccess(`"${emailClean}" kullanıcısının yetkileri güncellendi.`);
      } else {
        // Show shareable credential card
        setCreatedSummary({
          email: emailClean,
          password: activePassword,
          role: selectedRole === 'superadmin' ? 'Superadmin' : 'Ön Büro Müdürü / Editör',
          hotels: hotelNames
        });
        setSuccess(
          result.alreadyExistsInAuth
            ? `"${emailClean}" kullanıcısının yetkileri kaydedildi. Kullanıcı hesabı Firebase'de mevcuttu.`
            : `"${emailClean}" kullanıcısı ve şifresi başarıyla tanımlandı! Lütfen şifreyi kullanıcıya iletiniz.`
        );
      }

      resetForm();
      await fetchUsers();
    } catch (e: any) {
      console.error(e);
      if (e.code === 'auth/weak-password') {
        setError('Şifre çok zayıf. Lütfen en az 6 karakterli harf ve rakam içeren bir şifre giriniz.');
      } else if (e.code === 'auth/invalid-email') {
        setError('Geçersiz e-posta adresi formatı.');
      } else {
        setError('Kaydedilirken bir hata oluştu: ' + (e.message || 'Bilinmeyen hata'));
      }
    } finally {
      setSaving(false);
    }
  };

  const copyCredentialsText = () => {
    if (!createdSummary) return;
    const loginUrl = window.location.origin;
    const hotelText = createdSummary.hotels.length > 0 
      ? createdSummary.hotels.join(', ') 
      : 'Tüm Oteller';

    const text = `🏨 Otel Veri Yönetim Sistemi Giriş Bilgileriniz:
• Giriş Bağlantısı: ${loginUrl}
• E-posta: ${createdSummary.email}
• Şifreniz: ${createdSummary.password}
• Sistem Rolü: ${createdSummary.role}
• Yetkili Oteller: ${hotelText}

* Sisteme giriş yaptıktan sonra dilediğiniz zaman sağ üstteki kullanıcı menüsünden şifrenizi değiştirebilirsiniz.`;

    navigator.clipboard.writeText(text);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 3000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-5xl bg-white shadow-2xl rounded-2xl flex flex-col max-h-[92vh] border border-slate-200 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-slate-50/70">
          <div className="flex items-center gap-3">
             <div className="flex items-center justify-center w-10 h-10 bg-indigo-100 text-indigo-700 rounded-xl shadow-sm">
                <Users size={20} />
             </div>
             <div>
                <h3 className="text-lg font-bold text-slate-900">Kullanıcı & Şifre Yönetimi</h3>
                <p className="text-xs text-slate-500 font-medium">
                  Ön Büro Müdürlerini tanımlayın, şifrelerini belirleyin ve yetkili otellerini yönetin.
                </p>
             </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content (2 Columns: Form on Left, List on Right) */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-5 divide-y md:divide-y-0 md:divide-x divide-slate-200">
           
           {/* Left side: Add / Edit User Form */}
           <div className="p-6 md:col-span-2 overflow-y-auto space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  {isEditing ? 'Yetki Düzenle' : 'Yeni Kullanıcı & Şifre Tanımla'}
                </h4>
                {isEditing && (
                  <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                    Düzenleme Modu
                  </span>
                )}
              </div>

              {/* Informational Banner */}
              <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl flex items-start gap-2.5 text-indigo-900 text-xs">
                <KeyRound size={16} className="shrink-0 mt-0.5 text-indigo-600" />
                <p className="leading-relaxed">
                  <span className="font-bold">Şifreli Erişim:</span> Yeni kullanıcı tanımlarken şifresini siz belirlersiniz. Kullanıcı sisteme giriş yaptıktan sonra şifresini profilinden kendisi değiştirebilir.
                </p>
              </div>

              {/* Error Banner */}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-xs font-medium flex items-start gap-2">
                  <AlertCircle size={15} className="shrink-0 mt-0.5 text-red-600" />
                  <span>{error}</span>
                </div>
              )}

              {/* Success Banner */}
              {success && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-xl text-xs font-medium flex items-start gap-2">
                  <CheckCircle2 size={15} className="shrink-0 mt-0.5 text-emerald-600" />
                  <span>{success}</span>
                </div>
              )}

              {/* Created User Credentials Card (Ready to share with Front Office Manager) */}
              {createdSummary && (
                <div className="p-4 bg-amber-50/90 border border-amber-300 rounded-2xl space-y-3 animate-in fade-in duration-200 text-amber-950">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-amber-900 flex items-center gap-1.5">
                      <Share2 size={14} className="text-amber-700" />
                      Kullanıcıya İletilecek Bilgiler
                    </span>
                    <span className="text-[10px] bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded-full font-bold">
                      Yeni Hesap
                    </span>
                  </div>

                  <div className="p-3 bg-white/95 rounded-xl border border-amber-200/90 space-y-1.5 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-medium">E-posta:</span>
                      <span className="font-semibold text-slate-900 font-mono text-[11px]">{createdSummary.email}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-medium">Şifre:</span>
                      <span className="font-bold text-indigo-700 font-mono text-xs bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                        {createdSummary.password}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-medium">Rol:</span>
                      <span className="font-medium text-slate-800">{createdSummary.role}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={copyCredentialsText}
                    className="w-full py-2 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all"
                  >
                    {copiedSummary ? <Check size={14} /> : <Copy size={14} />}
                    {copiedSummary ? 'Giriş Bilgileri Kopyalandı!' : 'Tüm Giriş Bilgilerini Kopyala (WhatsApp / E-posta)'}
                  </button>
                </div>
              )}

              <form onSubmit={handleSave} className="space-y-4">
                 {/* Email Input */}
                 <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Kullanıcı / Ön Büro Müdürü E-posta
                    </label>
                    <input
                       type="email"
                       required
                       disabled={isEditing}
                       className="w-full text-xs sm:text-sm border border-slate-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-100 font-medium"
                       placeholder="onburo@otel.com"
                       value={emailInput}
                       onChange={(e) => setEmailInput(e.target.value)}
                    />
                 </div>

                 {/* Password Input (Only active when creating or explicitly resetting) */}
                 <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-slate-700">
                        {isEditing ? 'Şifre (Değiştirmek İstemiyorsanız Boş Bırakın)' : 'İlk Giriş Şifresi'}
                      </label>
                      {!isEditing && (
                        <button
                          type="button"
                          onClick={handleGeneratePassword}
                          className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 hover:underline"
                        >
                          <Sparkles size={12} />
                          Güvenli Şifre Üret
                        </button>
                      )}
                    </div>

                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required={!isEditing}
                        minLength={6}
                        className="w-full text-xs sm:text-sm border border-slate-300 rounded-xl px-3 py-2 pr-10 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono"
                        placeholder={isEditing ? 'Mevcut şifre korunur...' : 'Örn: Otel2026!#'}
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                 </div>

                 {/* System Role Selection */}
                 <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Sistem Rolü</label>
                    <select
                       className="w-full text-xs sm:text-sm border border-slate-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white font-medium"
                       value={selectedRole}
                       onChange={(e) => setSelectedRole(e.target.value as 'superadmin' | 'editor')}
                    >
                       <option value="editor">Ön Büro Müdürü / Editör (Otel Bazlı Yetkili)</option>
                       <option value="superadmin">Superadmin (Tüm Oteller & Tam Yetkili)</option>
                    </select>
                 </div>

                 {/* Hotel Selection for Editor */}
                 {selectedRole === 'editor' && (
                    <div className="space-y-2">
                       <div className="flex items-center justify-between">
                         <label className="block text-xs font-bold text-slate-700">Yetkili Olacağı Oteller</label>
                         <span className="text-[10px] text-indigo-600 font-semibold">
                           {selectedHotels.length} Otel Seçildi
                         </span>
                       </div>
                       <div className="border border-slate-200 rounded-xl p-2.5 max-h-[160px] overflow-y-auto space-y-1.5 bg-slate-50/50">
                          {hotelsList.length === 0 ? (
                             <p className="text-xs text-slate-400">Sistemde henüz kayıtlı otel bulunmamaktadır.</p>
                          ) : (
                             hotelsList.map(hotel => (
                                <label key={hotel.id} className="flex items-center gap-2 text-xs text-slate-700 font-medium cursor-pointer p-1.5 rounded-lg hover:bg-white transition-colors">
                                   <input
                                      type="checkbox"
                                      className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                                      checked={selectedHotels.includes(hotel.id)}
                                      onChange={() => handleToggleHotel(hotel.id)}
                                   />
                                   <span className="truncate">{hotel.name}</span>
                                </label>
                             ))
                          )}
                       </div>
                       <p className="text-[10px] text-slate-500">
                         Ön Büro Müdürü yalnızca işaretlenen otel(ler)in verilerini düzenleyebilir ve içerik ekleyebilir.
                       </p>
                    </div>
                 )}

                 <div className="pt-2 flex gap-2">
                    {isEditing && (
                       <button
                          type="button"
                          onClick={resetForm}
                          className="flex-1 text-xs sm:text-sm border border-slate-300 hover:bg-slate-100 rounded-xl py-2.5 transition-colors font-semibold text-slate-700"
                       >
                          Vazgeç
                       </button>
                    )}
                    <button
                       type="submit"
                       disabled={saving}
                       className="flex-1 text-xs sm:text-sm bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold rounded-xl py-2.5 transition-all flex items-center justify-center gap-1.5 shadow-sm"
                    >
                       {saving ? (
                          <Loader2 size={16} className="animate-spin" />
                       ) : (
                          <Save size={16} />
                       )}
                       {isEditing ? 'Yetkileri Güncelle' : 'Kullanıcıyı Tanımla & Kaydet'}
                    </button>
                 </div>
              </form>
           </div>

           {/* Right side: User Roles List */}
           <div className="p-6 md:col-span-3 flex flex-col overflow-hidden bg-slate-50/40">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Yetkili Kullanıcılar ({userRoles.length + 1})
                </h4>
                <span className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                  <Lock size={11} /> Şifreli Giriş Aktif
                </span>
              </div>

              <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl bg-white shadow-sm">
                 {loading ? (
                    <div className="flex flex-col items-center justify-center h-full py-12 text-slate-400 gap-2">
                       <Loader2 size={24} className="animate-spin text-indigo-500" />
                       <span className="text-xs font-medium">Kullanıcılar yükleniyor...</span>
                    </div>
                 ) : (
                    <div className="divide-y divide-slate-100">
                       {/* Hardcoded Super Admin User */}
                       <div className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                          <div className="space-y-0.5">
                             <div className="flex items-center gap-2">
                                <span className="font-bold text-xs sm:text-sm text-slate-900">alper28072011@gmail.com</span>
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold bg-indigo-100 text-indigo-800">
                                   <Shield size={10} className="mr-1" /> superadmin
                                </span>
                             </div>
                             <p className="text-[11px] text-slate-500 font-medium">Sistem Kurucusu & Tam Yetkili</p>
                          </div>
                          <span className="text-[11px] text-slate-400 font-semibold">Varsayılan</span>
                       </div>

                       {userRoles.map(user => (
                          <div key={user.email} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                             <div className="space-y-1 min-w-0 pr-3">
                                <div className="flex items-center gap-2 flex-wrap">
                                   <span className="font-bold text-xs sm:text-sm text-slate-800 truncate">{user.email}</span>
                                   <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                                      user.role === 'superadmin' 
                                         ? 'bg-indigo-100 text-indigo-800' 
                                         : 'bg-emerald-100 text-emerald-800'
                                   }`}>
                                      <Shield size={10} className="mr-1" /> 
                                      {user.role === 'editor' ? 'Ön Büro / Editör' : user.role}
                                   </span>
                                </div>
                                {user.role === 'editor' && (
                                   <p className="text-[11px] text-slate-500 font-medium">
                                      Yetkili Otel Sayısı: <span className="font-bold text-slate-700">{user.allowedHotels.length}</span>
                                      {user.allowedHotels.length > 0 ? (
                                        <span className="truncate block mt-0.5 text-slate-400">
                                          ({user.allowedHotels.map(id => hotelsList.find(h => h.id === id)?.name || id).join(', ')})
                                        </span>
                                      ) : (
                                        <span className="text-amber-600 block mt-0.5 font-semibold">(Henüz otel atanmadı)</span>
                                      )}
                                   </p>
                                )}
                             </div>
                             <div className="flex items-center gap-2 shrink-0">
                                <button
                                   onClick={() => handleSendResetEmailToUser(user.email)}
                                   disabled={resettingEmail === user.email}
                                   className="text-[11px] text-slate-600 hover:text-indigo-600 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-lg font-semibold flex items-center gap-1 transition-colors"
                                   title="Kullanıcıya şifre sıfırlama bağlantısı gönder"
                                >
                                   {resettingEmail === user.email ? (
                                     <Loader2 size={12} className="animate-spin" />
                                   ) : (
                                     <Send size={11} />
                                   )}
                                   Şifre Sıfırla
                                </button>
                                <button
                                   onClick={() => handleEditUser(user)}
                                   className="text-xs text-indigo-600 hover:text-indigo-800 font-bold px-1.5 py-1 hover:underline"
                                >
                                   Düzenle
                                </button>
                                <button
                                   onClick={() => handleDeleteUser(user.email)}
                                   disabled={deletingEmail === user.email}
                                   className="text-xs text-red-500 hover:text-red-700 font-bold px-1.5 py-1 hover:underline flex items-center gap-1"
                                   title="Yetkiyi Kaldır"
                                >
                                   {deletingEmail === user.email ? (
                                     <Loader2 size={12} className="animate-spin" />
                                   ) : (
                                     <Trash2 size={12} />
                                   )}
                                   Sil
                                </button>
                             </div>
                          </div>
                       ))}
                    </div>
                 )}
              </div>
           </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end">
          <button 
            onClick={onClose}
            className="px-5 py-2 bg-slate-200 text-slate-800 font-bold hover:bg-slate-300 rounded-xl transition-colors text-xs shadow-sm"
          >
            Kapat
          </button>
        </div>

      </div>
    </div>
  );
};

export default UserManagementModal;
