import { create } from 'zustand';
import { supabase } from '../lib/supabase';

const USER_KEY = 'summerdent_user';
const SEDE_KEY = 'summerdent_sede_activa';

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
  authReady: true,
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
    } catch {
      void 0;
    }

    let sedeActivaToSet = null;
    try {
      const stored = getStoredSedeActiva();
      if (safeUser && safeUser.rol === 'administrador') {
        sedeActivaToSet = safeUser.sede_id ?? null;
      } else {
        sedeActivaToSet = stored ?? null;
      }
    } catch {
      sedeActivaToSet = null;
    }

    if (sedeActivaToSet !== null) {
      try {
        localStorage.setItem(SEDE_KEY, String(sedeActivaToSet));
      } catch {
        void 0;
      }
    } else {
      try {
        localStorage.removeItem(SEDE_KEY);
      } catch {
        void 0;
      }
    }

    set({
      token: '',
      user: safeUser,
      isAuthenticated: Boolean(safeUser),
  authReady: false,
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
    } catch {
      void 0;
    }
    set({ sedeActiva: sedeId ?? null });
  },
  logout: async () => {
    await supabase.auth.signOut();

    try {
      localStorage.removeItem(USER_KEY);
    } catch {
      void 0;
    }

    try {
      localStorage.removeItem(SEDE_KEY);
    } catch {
      void 0;
    }

    set({ token: '', user: null, isAuthenticated: false, authReady: true, sedeActiva: null });
  }
}));
