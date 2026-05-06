import { create } from 'zustand';

const TOKEN_KEY = 'summerdent_access_token';
const USER_KEY = 'summerdent_user';

const getStoredToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
};

const getStoredUser = () => {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const useAuthStore = create((set) => ({
  token: getStoredToken(),
  user: getStoredUser(),
  isAuthenticated: Boolean(getStoredToken()),
  setSession: ({ token, user }) => {
    const safeToken = token || '';
    const safeUser = user || null;

    try {
      if (safeToken) {
        localStorage.setItem(TOKEN_KEY, safeToken);
      } else {
        localStorage.removeItem(TOKEN_KEY);
      }

      if (safeUser) {
        localStorage.setItem(USER_KEY, JSON.stringify(safeUser));
      } else {
        localStorage.removeItem(USER_KEY);
      }
    } catch {
      // Ignore storage errors to keep app usable in restricted environments.
    }

    set({
      token: safeToken,
      user: safeUser,
      isAuthenticated: Boolean(safeToken)
    });
  },
  logout: () => {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    } catch {
      // Ignore storage errors.
    }

    set({ token: '', user: null, isAuthenticated: false });
  }
}));
