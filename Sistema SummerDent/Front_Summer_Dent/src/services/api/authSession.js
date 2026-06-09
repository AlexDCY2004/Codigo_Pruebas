const baseURL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

export const refreshAccessToken = async () => {
  const response = await fetch(`${baseURL}/api/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'No se pudo refrescar el token');
  }

  return response.json();
};
