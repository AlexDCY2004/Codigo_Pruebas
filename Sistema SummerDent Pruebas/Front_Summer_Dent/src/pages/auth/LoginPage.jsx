import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../services/api/client';
import { useAuthStore } from '../../store/authStore';
import logoImage from '../../assets/Logo.png';

export default function LoginPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);

  const [form, setForm] = useState({ email: '', password: '' });
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
          <input
            id="password"
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            required
            autoComplete="current-password"
            placeholder="........"
          />

          {errorMessage ? <p className="auth-error">{errorMessage}</p> : null}

          <button type="submit" disabled={isLoading}>
            {isLoading ? 'Iniciando...' : 'Iniciar sesión'}
          </button>
        </div>
      </form>
    </section>
  );
}
