import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import apiClient from '../../services/api/client';
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
        const { data } = await apiClient.get('/api/auth/perfil');
        if (!mounted) return;
        if (data?.id) {
          setSession({ user: data });
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

    return () => {
      mounted = false;
    };
  }, [setSession, logout, setAuthReady]);

  // Cuando cambia la sede limpia el cache y recarga las queries
  useEffect(() => {
    if (sedeActiva) {
      queryClient.invalidateQueries();
    }
  }, [sedeActiva, queryClient]);

  // Cuando se hace logout limpia todo el cache
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