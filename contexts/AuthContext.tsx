import React, { createContext, useContext, useEffect, useState, ReactNode, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { Loader2 } from 'lucide-react';
import { syncOfflineData } from '../services/storageService';
import { User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);

      if (session?.user && navigator.onLine) {
        syncOfflineData(session.user.id).catch(error => {
          console.error('Background sync on login failed:', error);
        });
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);

      if (session?.user && navigator.onLine) {
        syncOfflineData(session.user.id).catch(error => {
          console.error('Background sync on login failed:', error);
        });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const contextValue = useMemo(() => ({ user, loading }), [user, loading]);

  if (loading) {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-slate-50">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
        <p className="mt-4 text-slate-500">Initializing Session...</p>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
