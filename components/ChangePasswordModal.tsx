import React, { useState } from 'react';
import { X, KeyRound, Lock, Eye, EyeOff, Loader2, CheckCircle2, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { changeCurrentUserPassword } from '../services/adminAuthService';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ isOpen, onClose }) => {
  const { currentUser } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!isOpen || !currentUser) return null;

  const resetForm = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError(null);
    setSuccess(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!currentPassword) {
      setError('Lütfen mevcut şifrenizi giriniz.');
      return;
    }

    if (newPassword.length < 6) {
      setError('Yeni şifreniz en az 6 karakter uzunluğunda olmalıdır.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Yeni şifreler birbiriyle eşleşmiyor. Lütfen kontrol ediniz.');
      return;
    }

    if (currentPassword === newPassword) {
      setError('Yeni şifreniz mevcut şifrenizle aynı olamaz. Lütfen farklı bir şifre belirleyiniz.');
      return;
    }

    setLoading(true);

    try {
      await changeCurrentUserPassword(currentUser, currentPassword, newPassword);
      setSuccess('Şifreniz başarıyla güncellendi! Bir sonraki girişinizde yeni şifrenizi kullanabilirsiniz.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      console.error('Password change error', err);
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Mevcut şifrenizi hatalı girdiniz. Lütfen tekrar deneyiniz.');
      } else if (err.code === 'auth/weak-password') {
        setError('Belirlediğiniz şifre çok zayıf. Lütfen daha güçlü bir şifre seçiniz.');
      } else if (err.code === 'auth/requires-recent-login') {
        setError('Güvenlik nedeniyle şifre değiştirmek için lütfen oturumunuzu kapatıp tekrar giriş yapınız.');
      } else {
        setError(err.message || 'Şifre güncellenirken bir hata oluştu.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-indigo-100 text-indigo-700 rounded-xl flex items-center justify-center font-bold">
              <KeyRound size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Şifre Değiştir</h3>
              <p className="text-xs text-slate-500 font-medium truncate max-w-[240px]">
                {currentUser.email}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium leading-relaxed">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2 text-xs text-emerald-800 font-medium">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Current Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mevcut Şifreniz
              </label>
              <div className="relative">
                <input
                  type={showCurrent ? 'text' : 'password'}
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full text-sm border border-slate-300 rounded-xl px-3.5 py-2.5 pr-10 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
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
                  className="w-full text-sm border border-slate-300 rounded-xl px-3.5 py-2.5 pr-10 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Güçlü bir şifre için harf, rakam ve sembol kullanabilirsiniz.
              </p>
            </div>

            {/* Confirm New Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Yeni Şifre (Tekrar)
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Yeni şifrenizi doğrulayın"
                  className="w-full text-sm border border-slate-300 rounded-xl px-3.5 py-2.5 pr-10 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
              >
                İptal
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                Şifreyi Güncelle
              </button>
            </div>
          </form>
        </div>

      </div>
    </div>
  );
};

export default ChangePasswordModal;
