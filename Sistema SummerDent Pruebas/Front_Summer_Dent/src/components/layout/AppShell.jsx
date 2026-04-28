import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import logoImage from '../../assets/Logo.png';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: 'grid' },
  { to: '/pacientes', label: 'Pacientes', icon: 'users' },
  { to: '/citas', label: 'Citas', icon: 'calendar' },
  { to: '/doctores', label: 'Odontologos', icon: 'doctor' },
  { to: '/tratamientos', label: 'Tratamientos', icon: 'pill' },
  { to: '/ingresos', label: 'Ingresos', icon: 'trend-up' },
  { to: '/egresos', label: 'Egresos', icon: 'trend-down' },
  { to: '/financiero', label: 'Financiero', icon: 'chart' },
  { to: '/inventario', label: 'Inventario', icon: 'box' }
];

const Icon = ({ type }) => {
  const common = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2' };
  if (type === 'users') return <svg {...common}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
  if (type === 'calendar') return <svg {...common}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
  if (type === 'doctor') return <svg {...common}><circle cx="8" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h2"/><circle cx="17" cy="17" r="4"/><path d="M17 15v4"/><path d="M15 17h4"/></svg>;
  if (type === 'pill') return <svg {...common}><path d="M10.5 13.5 18 6a4.2 4.2 0 1 0-6-6L4.5 7.5a4.2 4.2 0 1 0 6 6Z"/><path d="m8.5 5.5 10 10"/></svg>;
  if (type === 'trend-up') return <svg {...common}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>;
  if (type === 'trend-down') return <svg {...common}><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>;
  if (type === 'chart') return <svg {...common}><path d="M21 12a9 9 0 1 1-9-9"/><path d="M21 3v9h-9"/></svg>;
  if (type === 'box') return <svg {...common}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.3 7 12 12 20.7 7"/><line x1="12" y1="22" x2="12" y2="12"/></svg>;
  return <svg {...common}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>;
};

export default function AppShell() {
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  return (
    <div className="app-shell">
      <aside className="app-shell__sidebar">
        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const isActive = location.pathname === item.to;

            return (
              <Link
                key={item.to}
                to={item.to}
                className={isActive ? 'nav-link nav-link--active' : 'nav-link'}
                onClick={() => {
                  // remove focus after navigation so sidebar collapses when mouse leaves
                  try {
                    if (document && document.activeElement) document.activeElement.blur();
                  } catch {
                    /* ignore */
                  }
                }}
              >
                <Icon type={item.icon} />
                <span className="nav-label">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <section className="app-shell__content">
        <header className="app-shell__header">
          <div className="header-brand">
            <img src={logoImage} alt="Logo Summer Dent" className="header-brand__logo" />
            <div>
              <h2>Summer Dent</h2>
            </div>
          </div>
          <div className="header-user-block">
            <div className="header-user-info">
              <span>{user?.nombre || 'Secretaria Principal'}</span>
            </div>
            <button type="button" onClick={logout} className="logout-btn">
              Cerrar sesión
            </button>
          </div>
        </header>

        <main className="app-shell__main">
          <Outlet />
        </main>
      </section>
    </div>
  );
}
