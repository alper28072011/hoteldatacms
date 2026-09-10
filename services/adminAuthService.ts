import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signOut, 
  sendPasswordResetEmail,
  reauthenticateWithCredential,
  EmailAuthProvider,
  updatePassword,
  User
} from 'firebase/auth';
import { auth, firebaseConfig } from '../firebaseConfig';
import { saveUserRole } from './firestoreService';

const WORKER_APP_NAME = 'AdminSecondaryAuthApp';

function getSecondaryAuthApp(): FirebaseApp {
  const existingApps = getApps();
  const found = existingApps.find(app => app.name === WORKER_APP_NAME);
  if (found) return found;
  return initializeApp(firebaseConfig, WORKER_APP_NAME);
}

/**
 * Super Admin creates a new user account with initial password in Firebase Auth,
 * and sets their RBAC permissions in Firestore without disrupting current session.
 */
export async function adminCreateUserAccount(
  email: string,
  password: string,
  role: 'superadmin' | 'editor',
  allowedHotels: string[]
): Promise<{ createdInAuth: boolean; alreadyExistsInAuth: boolean }> {
  const cleanEmail = email.toLowerCase().trim();

  let createdInAuth = false;
  let alreadyExistsInAuth = false;

  const secondaryApp = getSecondaryAuthApp();
  const secondaryAuth = getAuth(secondaryApp);

  try {
    // Attempt creating the auth user account
    await createUserWithEmailAndPassword(secondaryAuth, cleanEmail, password);
    createdInAuth = true;
  } catch (err: any) {
    if (err.code === 'auth/email-already-in-use') {
      alreadyExistsInAuth = true;
    } else {
      throw err;
    }
  } finally {
    try {
      await signOut(secondaryAuth);
    } catch {
      // Ignore worker sign-out error
    }
  }

  // Save or update roles in Firestore
  await saveUserRole(cleanEmail, role, role === 'superadmin' ? [] : allowedHotels);

  return { createdInAuth, alreadyExistsInAuth };
}

/**
 * Super Admin or user triggers standard Firebase password reset email.
 */
export async function sendUserPasswordReset(email: string): Promise<void> {
  const cleanEmail = email.toLowerCase().trim();
  await sendPasswordResetEmail(auth, cleanEmail);
}

/**
 * Logged-in user changes their own password with current password verification.
 */
export async function changeCurrentUserPassword(
  user: User,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  if (!user.email) {
    throw new Error('Kullanıcı e-posta adresi bulunamadı.');
  }

  if (!newPassword || newPassword.length < 6) {
    throw new Error('Yeni şifre en az 6 karakter uzunluğunda olmalıdır.');
  }

  // 1. Re-authenticate to ensure security
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);

  // 2. Update password
  await updatePassword(user, newPassword);
}

/**
 * Helper to generate a memorable yet strong initial password for users.
 */
export function generateRandomPassword(): string {
  const words = ['Otel', 'Atlas', 'Nova', 'Grand', 'Palace', 'Vista', 'Resort', 'Plaza', 'Zenith', 'Crown'];
  const symbols = ['!', '@', '#', '$', '%', '&', '*'];
  const randomWord = words[Math.floor(Math.random() * words.length)];
  const randomNum = Math.floor(1000 + Math.random() * 9000); // 4 digits
  const randomSymbol = symbols[Math.floor(Math.random() * symbols.length)];
  return `${randomWord}${randomNum}${randomSymbol}`;
}
