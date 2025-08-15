import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { User } from '../types';

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  login: (email: string, password: string, role: User['role'], name: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setCurrentUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email!,
            role: userData.role,
            name: userData.name,
            createdAt: userData.createdAt.toDate()
          });
        }
      } else {
        setCurrentUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = async (email: string, password: string, role: User['role'], name: string) => {
    // Define fixed emails for each role
    const roleEmails = {
      'EB': ['eb@society.com', 'eb1@society.com', 'eb2@society.com'],
      'EC': ['ec@society.com', 'ec1@society.com', 'ec2@society.com'],
      'Core': ['core@society.com', 'core1@society.com', 'core2@society.com'],
      'Member': ['member@society.com', 'member1@society.com', 'member2@society.com', 'member3@society.com']
    };

    // Check if email is authorized for the selected role
    if (!roleEmails[role].includes(email.toLowerCase())) {
      throw new Error(`Email ${email} is not authorized for ${role} role. Please use an authorized email.`);
    }

    try {
      const { user } = await signInWithEmailAndPassword(auth, email, password);
    } catch (authError: any) {
      if (authError.code === 'auth/user-not-found') {
        // Create user if they don't exist but email is authorized
        const { user } = await createUserWithEmailAndPassword(auth, email, password);
      } else {
        throw authError;
      }
    }

    const { user } = await signInWithEmailAndPassword(auth, email, password);
    
    // Update user role in Firestore
    await setDoc(doc(db, 'users', user.uid), {
      name: name || user.email?.split('@')[0] || 'User',
      email: user.email,
      role,
      createdAt: new Date()
    }, { merge: true });
  };

  const logout = async () => {
    await signOut(auth);
  };

  const value = {
    currentUser,
    loading,
    login,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};