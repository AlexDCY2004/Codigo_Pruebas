import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import apiClient from '../../services/api/client';
import { useAuthStore } from '../../store/authStore';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1
    }
  }
});

export default function AppProviders({ children }) {
  const setSession = useAuthStore((state) => state.setSession);
  const logout = useAuthStore((state) => state.logout);
  const setAuthReady = useAuthStore((state) => state.setAuthReady);

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

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
