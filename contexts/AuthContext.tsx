import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signOut, updateProfile } from 'firebase/auth';
import { auth } from '../firebaseConfig';
import { getUserRole, updateUserProfile, UserProfileData } from '../services/firestoreService';

interface AuthContextType {
  currentUser: User | null;
  userRole: 'superadmin' | 'editor' | null;
  allowedHotels: string[];
  userProfile: UserProfileData | null;
  loading: boolean;
  authError: string | null;
  clearAuthError: () => void;
  logout: () => Promise<void>;
  refreshRole: () => Promise<void>;
  updateProfileData: (data: UserProfileData) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<'superadmin' | 'editor' | null>(null);
  const [allowedHotels, setAllowedHotels] = useState<string[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const clearAuthError = () => setAuthError(null);

  const fetchAndSetRole = async (user: User) => {
    if (user.email) {
      try {
        const { role, allowedHotels, isAuthorized, profile } = await getUserRole(user.email);
        if (!isAuthorized) {
          console.warn(`Unauthorized login attempt by ${user.email}`);
          await signOut(auth);
          setCurrentUser(null);
          setUserRole(null);
          setUserProfile(null);
          setAllowedHotels([]);
          setAuthError(`"${user.email}" e-posta adresi sistemde tanımlı değildir. Sisteme yalnızca Super Admin tarafından eklenen Ön Büro Müdürleri ve yöneticiler erişebilir.`);
          return false;
        }
        setUserRole(role);
        setAllowedHotels(allowedHotels);
        setUserProfile(profile || { displayName: user.displayName || '', title: role === 'superadmin' ? 'Super Admin' : 'Ön Büro Müdürü' });
        setAuthError(null);
        return true;
      } catch (e) {
        console.error("Error setting user role", e);
        setUserRole('editor');
        setAllowedHotels([]);
        setUserProfile({ displayName: user.displayName || '', title: 'Ön Büro Müdürü' });
        return true;
      }
    } else {
      setUserRole('editor');
      setAllowedHotels([]);
      setUserProfile(null);
      return false;
    }
  };

  const refreshRole = async () => {
    if (currentUser) {
      await fetchAndSetRole(currentUser);
    }
  };

  const updateProfileData = async (data: UserProfileData) => {
    if (!currentUser?.email) return;
    await updateUserProfile(currentUser.email, data);
    if (data.displayName && currentUser) {
      try {
        await updateProfile(currentUser, { displayName: data.displayName });
      } catch (err) {
        console.warn("Could not update auth displayName", err);
      }
    }
    setUserProfile(prev => ({ ...prev, ...data }));
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const authorized = await fetchAndSetRole(user);
        if (authorized) {
          setCurrentUser(user);
        }
      } else {
        setCurrentUser(null);
        setUserRole(null);
        setUserProfile(null);
        setAllowedHotels([]);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const logout = async () => {
    await signOut(auth);
    setCurrentUser(null);
    setUserRole(null);
    setUserProfile(null);
    setAllowedHotels([]);
  };

  return (
    <AuthContext.Provider value={{ 
      currentUser, 
      userRole, 
      allowedHotels, 
      userProfile, 
      loading, 
      authError, 
      clearAuthError, 
      logout, 
      refreshRole,
      updateProfileData
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
