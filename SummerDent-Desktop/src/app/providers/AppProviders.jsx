import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';

export default function AppProviders({ children }) {
  const setSession = useAuthStore((state) => state.setSession);
  const logout = useAuthStore((state) => state.logout);
  const setAuthReady = useAuthStore((state) => state.setAuthReady);
  const sedeActiva = useAuthStore((state) => state.sedeActiva);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: 1
      }
    }
  }));

  useEffect(() => {
    let mounted = true;

    const bootstrapAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!mounted) return;

        if (session?.user) {
          const { data: perfil } = await supabase
            .from('perfil')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if (!mounted) return;

          if (perfil) {
            setSession({ user: perfil });
          } else {
            setAuthReady(true);
          }
        } else {
          setAuthReady(true);
        }
      } catch {
        if (!mounted) return;
        logout();
      } finally {
        if (mounted) setAuthReady(true);
      }
    };

    bootstrapAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      if (!session) {
        logout();
      }
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, [setSession, logout, setAuthReady]);

  useEffect(() => {
    if (sedeActiva) {
      queryClient.invalidateQueries();
    }
  }, [sedeActiva, queryClient]);

  useEffect(() => {
    if (!isAuthenticated) {
      queryClient.clear();
    }
  }, [isAuthenticated, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
