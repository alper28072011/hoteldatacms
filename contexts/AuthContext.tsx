import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '../firebaseConfig';
import { getUserRole } from '../services/firestoreService';

interface AuthContextType {
  currentUser: User | null;
  userRole: 'superadmin' | 'editor' | null;
  allowedHotels: string[];
  loading: boolean;
  logout: () => Promise<void>;
  refreshRole: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<'superadmin' | 'editor' | null>(null);
  const [allowedHotels, setAllowedHotels] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAndSetRole = async (user: User) => {
    if (user.email) {
      try {
        const { role, allowedHotels } = await getUserRole(user.email);
        setUserRole(role);
        setAllowedHotels(allowedHotels);
      } catch (e) {
        console.error("Error setting user role", e);
        setUserRole('editor');
        setAllowedHotels([]);
      }
    } else {
      setUserRole('editor');
      setAllowedHotels([]);
    }
  };

  const refreshRole = async () => {
    if (currentUser) {
      await fetchAndSetRole(currentUser);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        await fetchAndSetRole(user);
      } else {
        setUserRole(null);
        setAllowedHotels([]);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const logout = () => signOut(auth);

  return (
    <AuthContext.Provider value={{ currentUser, userRole, allowedHotels, loading, logout, refreshRole }}>
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
