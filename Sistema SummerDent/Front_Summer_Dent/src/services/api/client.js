import axios from 'axios';
import { useAuthStore } from '../../store/authStore';
import { refreshAccessToken } from './authSession';

const baseURL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

export const apiClient = axios.create({
  baseURL,
  timeout: 12000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

apiClient.interceptors.request.use((config) => {
  const sedeActiva = useAuthStore.getState().sedeActiva;
  const requestUrl = String(config.url || '');
  const requestMethod = String(config.method || 'get').toLowerCase();
  const isCitasUpdate = requestUrl.startsWith('/api/citas/') && (requestMethod === 'put' || requestMethod === 'patch');

  // Propagar sedeActiva:
  // - Para GET requests: añadir como query param `sede_id` si está definida
  try {
    if (sedeActiva !== null && sedeActiva !== undefined && !isCitasUpdate) {
      if (!config.params) config.params = {};
      if (!config.method || requestMethod === 'get' || requestMethod === 'delete') {
        config.params = { ...(config.params || {}), sede_id: sedeActiva };
      } else {
        if (!config.data) config.data = {};
        if (typeof config.data === 'object' && config.data !== null && config.data.sede_id === undefined) {
          config.data.sede_id = sedeActiva;
        }
      }
    }
  } catch {
    // fail silently
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error?.response?.status === 401 && !error.config?._retry) {
      try {
        const data = await refreshAccessToken();
        if (data?.usuario) {
          useAuthStore.getState().setSession({ user: data.usuario });
        }

        const config = { ...error.config, _retry: true };
        return apiClient.request(config);
      } catch {
        // fall through to logout
      }

      useAuthStore.getState().logout();
    }

    return Promise.reject(error);
  }
);

export default apiClient;
