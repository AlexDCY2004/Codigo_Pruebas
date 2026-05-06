import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../services/api/client';
import { useAuthStore } from '../../store/authStore';
import logoImage from '../../assets/Logo.png';

export default function LoginPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);

  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    try {
      const { data } = await apiClient.post('/api/auth/login', {
        email: form.email.trim(),
        password: form.password
      });

      setSession({
        token: data?.access_token,
        user: data?.usuario || null
      });

      navigate('/dashboard', { replace: true });
    } catch (error) {
      if (!error?.response) {
        setErrorMessage('No se pudo conectar al backend. Revisa VITE_BACKEND_URL y CORS.');
      } else {
        setErrorMessage(error?.response?.data?.error || 'No fue posible iniciar sesión.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="auth-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-brand">
          <img src={logoImage} alt="Logo Summer Dent" className="login-logo" />
          <h1>Summer Dent</h1>
          <p>Sistema de Gestión Dental</p>
        </div>

        <div className="login-form-grid">
          <label htmlFor="email">Correo electrónico</label>
          <input
            id="email"
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            required
            autoComplete="email"
            placeholder="correo@ejemplo.com"
          />

          <label htmlFor="password">Contraseña</label>
          <div className="password-field">
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={handleChange}
              required
              autoComplete="current-password"
              placeholder="........"
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
              {showPassword ? (
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path d="M13.875 18.825A10.05 10.05 0 0 1 12 19c-5 0-9-3.5-10-8 1.03-2.86 3.63-5.16 6.63-6.13" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M3 3l18 18" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M9.88 9.88A3 3 0 0 0 14.12 14.12" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path d="M1.5 12s4.5-7.5 10.5-7.5S22.5 12 22.5 12s-4.5 7.5-10.5 7.5S1.5 12 1.5 12z" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          </div>

          {errorMessage ? <p className="auth-error">{errorMessage}</p> : null}

          <button type="submit" disabled={isLoading}>
            {isLoading ? 'Iniciando...' : 'Iniciar sesión'}
          </button>
        </div>
      </form>
    </section>
  );
}
