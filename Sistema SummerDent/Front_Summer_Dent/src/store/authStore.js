import { create } from 'zustand';

const USER_KEY = 'summerdent_user';
const SEDE_KEY = 'summerdent_sede_activa';

const baseURL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

const getStoredUser = () => {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const getStoredSedeActiva = () => {
  try {
    const raw = localStorage.getItem(SEDE_KEY);
    return raw ? Number(raw) : null;
  } catch {
    return null;
  }
};

export const useAuthStore = create((set) => ({
  token: '',
  user: getStoredUser(),
  isAuthenticated: Boolean(getStoredUser()),
  authReady: false,
  sedeActiva: getStoredSedeActiva(),
  setAuthReady: (ready) => set({ authReady: Boolean(ready) }),
  setSession: ({ user }) => {
    const safeUser = user || null;
    try {
      if (safeUser) {
        localStorage.setItem(USER_KEY, JSON.stringify(safeUser));
      } else {
        localStorage.removeItem(USER_KEY);
      }
    } catch (e) {
      void e;
    }

    let sedeActivaToSet = null;
    try {
      const stored = getStoredSedeActiva();
      if (safeUser && safeUser.rol === 'administrador') {
        sedeActivaToSet = safeUser.sede_id ?? null;
      } else {
        sedeActivaToSet = stored ?? null;
      }
    } catch (e) {
      void e;
      sedeActivaToSet = null;
    }

    if (sedeActivaToSet !== null) {
      try {
        localStorage.setItem(SEDE_KEY, String(sedeActivaToSet));
      } catch (e) {
        void e;
      }
    } else {
      try {
        localStorage.removeItem(SEDE_KEY);
      } catch (e) {
        void e;
      }
    }

    set({
      token: '',
      user: safeUser,
      isAuthenticated: Boolean(safeUser),
      authReady: true,
      sedeActiva: sedeActivaToSet
    });
  },
  setSedeActiva: (sedeId) => {
    try {
      if (sedeId === null || typeof sedeId === 'undefined') {
        localStorage.removeItem(SEDE_KEY);
      } else {
        localStorage.setItem(SEDE_KEY, String(sedeId));
      }
    } catch (e) {
      void e;
    }
    // Solo actualiza el estado, React Query se encarga del resto
    set({ sedeActiva: sedeId ?? null });
  },
  logout: () => {
    try {
      void fetch(`${baseURL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
    } catch (e) {
      void e;
    }

    try {
      localStorage.removeItem(USER_KEY);
    } catch (e) {
      void e;
    }

    try {
      localStorage.removeItem(SEDE_KEY);
    } catch (e) {
      void e;
    }

    set({ token: '', user: null, isAuthenticated: false, authReady: true, sedeActiva: null });
  }
}));