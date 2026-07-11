import React, { useState, useEffect } from 'react';
import { X, Users, Save, Shield, Check, Loader2, Hotel } from 'lucide-react';
import { getAllUserRoles, saveUserRole } from '../services/firestoreService';

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

const UserManagementModal: React.FC<UserManagementModalProps> = ({ isOpen, onClose, hotelsList }) => {
  const [userRoles, setUserRoles] = useState<UserRoleItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form State
  const [emailInput, setEmailInput] = useState('');
  const [selectedRole, setSelectedRole] = useState<'superadmin' | 'editor'>('editor');
  const [selectedHotels, setSelectedHotels] = useState<string[]>([]);
  const [isEditing, setIsEditing] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await getAllUserRoles();
      // Ensure we sort alphabetically
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
    setSelectedRole('editor');
    setSelectedHotels([]);
    setIsEditing(false);
    setError(null);
    setSuccess(null);
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
    setSelectedRole(user.role);
    setSelectedHotels(user.allowedHotels);
    setIsEditing(true);
    setError(null);
    setSuccess(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput) {
      setError('Lütfen geçerli bir e-posta adresi girin.');
      return;
    }

    const emailClean = emailInput.trim().toLowerCase();
    if (emailClean === 'alper28072011@gmail.com') {
      setError('Bu superadmin kullanıcısının yetkileri değiştirilemez.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await saveUserRole(emailClean, selectedRole, selectedRole === 'superadmin' ? [] : selectedHotels);
      setSuccess(isEditing ? 'Kullanıcı yetkileri güncellendi.' : 'Yeni kullanıcı yetkileri kaydedildi.');
      resetForm();
      await fetchUsers();
    } catch (e: any) {
      console.error(e);
      setError('Kaydedilirken bir hata oluştu: ' + (e.message || 'Bilinmeyen hata'));
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
      <div className="w-full max-w-4xl bg-white shadow-2xl rounded-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
             <div className="flex items-center justify-center w-10 h-10 bg-indigo-100 text-indigo-700 rounded-lg">
                <Users size={20} />
             </div>
             <div>
                <h3 className="text-xl font-semibold text-gray-900">Kullanıcı & Rol Yönetimi</h3>
                <p className="text-sm text-gray-500">Sistem yetkilerini ve otel erişim izinlerini düzenleyin.</p>
             </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content (Grid Layout: Form on Left, List on Right) */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-5 divide-y md:divide-y-0 md:divide-x divide-gray-200">
           
           {/* Left side: Add / Edit User Form */}
           <div className="p-6 md:col-span-2 overflow-y-auto space-y-4">
              <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
                {isEditing ? 'Yetki Düzenle' : 'Yeni Kullanıcı Yetkilendir'}
              </h4>

              {error && (
                <div className="bg-red-50 border border-red-100 text-red-700 p-3 rounded-lg text-xs font-medium">
                  {error}
                </div>
              )}

              {success && (
                <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 p-3 rounded-lg text-xs font-medium">
                  {success}
                </div>
              )}

              <form onSubmit={handleSave} className="space-y-4">
                 <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Kullanıcı E-posta</label>
                    <input
                       type="email"
                       required
                       disabled={isEditing}
                       className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
                       placeholder="user@example.com"
                       value={emailInput}
                       onChange={(e) => setEmailInput(e.target.value)}
                    />
                 </div>

                 <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Sistem Rolü</label>
                    <select
                       className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                       value={selectedRole}
                       onChange={(e) => setSelectedRole(e.target.value as 'superadmin' | 'editor')}
                    >
                       <option value="editor">Editor (Otel Seviyesinde Kısıtlı)</option>
                       <option value="superadmin">Superadmin (Tam Yetkili)</option>
                    </select>
                 </div>

                 {selectedRole === 'editor' && (
                    <div className="space-y-2">
                       <label className="block text-xs font-medium text-gray-700">Yetkili Oteller</label>
                       <div className="border border-gray-200 rounded-lg p-3 max-h-[180px] overflow-y-auto space-y-2 bg-gray-50/50">
                          {hotelsList.length === 0 ? (
                             <p className="text-xs text-gray-400">Sistemde henüz kayıtlı otel bulunmamaktadır.</p>
                          ) : (
                             hotelsList.map(hotel => (
                                <label key={hotel.id} className="flex items-center gap-2 text-xs text-gray-700 font-medium cursor-pointer p-1 rounded hover:bg-white transition-colors">
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
                       <p className="text-[10px] text-gray-500">
                         Editor sadece yukarıda seçilen oteller üzerinde düzenleme (Save, AI Mimar, Ekleme vb.) yapabilir.
                       </p>
                    </div>
                 )}

                 <div className="pt-2 flex gap-2">
                    {isEditing && (
                       <button
                          type="button"
                          onClick={resetForm}
                          className="flex-1 text-sm border border-gray-300 hover:bg-gray-100 rounded-lg py-2 transition-colors font-medium text-gray-700"
                       >
                          Vazgeç
                       </button>
                    )}
                    <button
                       type="submit"
                       disabled={saving}
                       className="flex-1 text-sm bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium rounded-lg py-2 transition-all flex items-center justify-center gap-1.5 shadow-sm"
                    >
                       {saving ? (
                          <Loader2 size={16} className="animate-spin" />
                       ) : (
                          <Save size={16} />
                       )}
                       {isEditing ? 'Güncelle' : 'Kaydet'}
                    </button>
                 </div>
              </form>
           </div>

           {/* Right side: User Roles List */}
           <div className="p-6 md:col-span-3 flex flex-col overflow-hidden">
              <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3">
                Kayıtlı Kullanıcı İzinleri
              </h4>

              <div className="flex-1 overflow-y-auto border border-gray-200 rounded-xl bg-gray-50/50">
                 {loading ? (
                    <div className="flex flex-col items-center justify-center h-full py-12 text-gray-400 gap-2">
                       <Loader2 size={24} className="animate-spin text-indigo-500" />
                       <span className="text-xs">Kullanıcılar yükleniyor...</span>
                    </div>
                 ) : userRoles.length === 0 ? (
                    <div className="text-center py-12 text-gray-400 text-xs font-medium">
                       Veritabanında kayıtlı özel yetkilendirme bulunmuyor.
                    </div>
                 ) : (
                    <div className="divide-y divide-gray-200 bg-white">
                       {/* Hardcoded alper user display for informational purpose */}
                       <div className="p-4 flex items-center justify-between hover:bg-gray-50/30">
                          <div className="space-y-1">
                             <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm text-slate-900">alper28072011@gmail.com</span>
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-100 text-indigo-800">
                                   <Shield size={10} className="mr-1" /> superadmin
                                </span>
                             </div>
                             <p className="text-[11px] text-gray-500">Sistem Kurucusu & Tam Yetkili</p>
                          </div>
                          <span className="text-xs text-gray-400 font-medium">Varsayılan</span>
                       </div>

                       {userRoles.map(user => (
                          <div key={user.email} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                             <div className="space-y-1 min-w-0 pr-4">
                                <div className="flex items-center gap-2 flex-wrap">
                                   <span className="font-semibold text-sm text-slate-800 truncate">{user.email}</span>
                                   <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                                      user.role === 'superadmin' 
                                         ? 'bg-indigo-100 text-indigo-800' 
                                         : 'bg-emerald-100 text-emerald-800'
                                   }`}>
                                      <Shield size={10} className="mr-1" /> {user.role}
                                   </span>
                                </div>
                                {user.role === 'editor' && (
                                   <p className="text-[11px] text-gray-500">
                                      Yetkili Otel Sayısı: <span className="font-semibold text-slate-700">{user.allowedHotels.length}</span>
                                      {user.allowedHotels.length > 0 && (
                                        <span className="truncate block mt-0.5 text-gray-400">
                                          ({user.allowedHotels.map(id => hotelsList.find(h => h.id === id)?.name || id).join(', ')})
                                        </span>
                                      )}
                                   </p>
                                )}
                             </div>
                             <button
                                onClick={() => handleEditUser(user)}
                                className="text-xs text-indigo-600 hover:text-indigo-800 hover:underline font-semibold shrink-0"
                             >
                                Düzenle
                             </button>
                          </div>
                       ))}
                    </div>
                 )}
              </div>
           </div>

        </div>

        {/* Footer */}
        <div className="p-6 border-t bg-gray-50 rounded-b-2xl flex items-center justify-end">
          <button 
            onClick={onClose}
            className="px-5 py-2 bg-slate-200 text-slate-800 font-semibold hover:bg-slate-300 rounded-lg transition-colors text-sm shadow-sm"
          >
            Kapat
          </button>
        </div>

      </div>
    </div>
  );
};

export default UserManagementModal;
