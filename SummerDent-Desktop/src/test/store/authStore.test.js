import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAuthStore } from '../../store/authStore';

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      signOut: vi.fn()
    }
  }
}));

const initialState = {
  token: '',
  user: null,
  isAuthenticated: false,
  authReady: true,
  sedeActiva: null
};

describe('authStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState(initialState);
  });

  describe('setSession', () => {
    it('setea usuario y marca isAuthenticated como true', () => {
      const user = { id: '1', nombre: 'Admin', rol: 'superadmin', sede_id: 1 };
      useAuthStore.getState().setSession({ user });
      const state = useAuthStore.getState();
      expect(state.user).toEqual(user);
      expect(state.isAuthenticated).toBe(true);
    });

    it('guarda usuario en localStorage', () => {
      const user = { id: '1', nombre: 'Admin', rol: 'superadmin' };
      useAuthStore.getState().setSession({ user });
      const stored = JSON.parse(localStorage.getItem('summerdent_user'));
      expect(stored).toEqual(user);
    });

    it('limpia localStorage si user es null', () => {
      localStorage.setItem('summerdent_user', JSON.stringify({ id: '1' }));
      useAuthStore.getState().setSession({ user: null });
      expect(localStorage.getItem('summerdent_user')).toBeNull();
    });

    it('asigna sedeActiva del usuario si es administrador', () => {
      const user = { id: '1', nombre: 'Admin', rol: 'administrador', sede_id: 5 };
      useAuthStore.getState().setSession({ user });
      expect(useAuthStore.getState().sedeActiva).toBe(5);
    });

    it('no sobreescribe sedeActiva si el usuario es superadmin', () => {
      useAuthStore.getState().setSedeActiva(3);
      const user = { id: '1', nombre: 'Super', rol: 'superadmin', sede_id: 1 };
      useAuthStore.getState().setSession({ user });
      expect(useAuthStore.getState().sedeActiva).toBe(3);
    });
  });

  describe('logout', () => {
    it('limpia usuario y marca isAuthenticated como false', async () => {
      useAuthStore.getState().setSession({ user: { id: '1', nombre: 'Admin' } });
      await useAuthStore.getState().logout();
      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });

    it('limpia localStorage', async () => {
      localStorage.setItem('summerdent_user', JSON.stringify({ id: '1' }));
      localStorage.setItem('summerdent_sede_activa', '1');
      await useAuthStore.getState().logout();
      expect(localStorage.getItem('summerdent_user')).toBeNull();
      expect(localStorage.getItem('summerdent_sede_activa')).toBeNull();
    });
  });

  describe('setSedeActiva', () => {
    it('setea sedeActiva y la guarda en localStorage', () => {
      useAuthStore.getState().setSedeActiva(2);
      expect(useAuthStore.getState().sedeActiva).toBe(2);
      expect(localStorage.getItem('summerdent_sede_activa')).toBe('2');
    });

    it('limpia sedeActiva si se pasa null', () => {
      useAuthStore.getState().setSedeActiva(2);
      useAuthStore.getState().setSedeActiva(null);
      expect(useAuthStore.getState().sedeActiva).toBeNull();
    });
  });
});