import { Link, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import apiClient from '../../services/api/client';
import logoImage from '../../assets/Logo.png';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: 'grid' },
  { to: '/pacientes', label: 'Pacientes', icon: 'users' },
  { to: '/citas', label: 'Citas', icon: 'calendar' },
  { to: '/doctores', label: 'Odontólogos', icon: 'doctor' },
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
  if (type === 'pill') return <svg {...common} viewBox="0 -2 24 28" style={{ transform: 'translateY(5px)' }}><path d="M10.5 13.5 18 6a4.2 4.2 0 1 0-6-6L4.5 7.5a4.2 4.2 0 1 0 6 6Z"/><path d="m8.5 5.5 10 10"/></svg>;
  if (type === 'trend-up') return <svg {...common}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>;
  if (type === 'trend-down') return <svg {...common}><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>;
  if (type === 'chart') return <svg {...common}><path d="M21 12a9 9 0 1 1-9-9"/><path d="M21 3v9h-9"/></svg>;
  if (type === 'box') return <svg {...common}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.3 7 12 12 20.7 7"/><line x1="12" y1="22" x2="12" y2="12"/></svg>;
  return <svg {...common}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>;
};

const getUserInitials = (name) => {
  if (!name) return 'SD';

  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');

  return initials || 'SD';
};

export default function AppShell() {
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const sedeActiva = useAuthStore((state) => state.sedeActiva);
  const setSedeActiva = useAuthStore((state) => state.setSedeActiva);
  const [sedes, setSedes] = useState([]);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isMobileUserMenuOpen, setIsMobileUserMenuOpen] = useState(false);
  const [isSedeMenuOpen, setIsSedeMenuOpen] = useState(false);
  const desktopSedeSelectorRef = useRef(null);
  const mobileSedeSelectorRef = useRef(null);
  const userInitials = getUserInitials(user?.nombre);

  const sedeOptions = [
    { value: '', label: 'Todas las sedes' },
    ...sedes
      .filter((s) => ['Sede Quito', 'Sede El Carmen'].includes(s.nombre))
      .map((s) => ({ value: String(s.id), label: s.nombre }))
  ];

  const activeSedeLabel = sedeOptions.find((option) => option.value === String(sedeActiva ?? ''))?.label || 'Todas las sedes';

  useEffect(() => {
    let mounted = true;
    const fetchSedes = async () => {
      if (user && user.rol === 'superadmin') {
        try {
          const { data } = await apiClient.get('/api/sedes');
          if (mounted) setSedes(Array.isArray(data) ? data : []);
        } catch {
          if (mounted) setSedes([]);
        }
      }
    };

    fetchSedes();
    return () => {
      mounted = false;
    };
  }, [user]);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = isMobileSidebarOpen ? 'hidden' : previousOverflow;

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobileSidebarOpen]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      const isInsideDesktopSelector = desktopSedeSelectorRef.current?.contains(event.target);
      const isInsideMobileSelector = mobileSedeSelectorRef.current?.contains(event.target);

      if (!isInsideDesktopSelector && !isInsideMobileSelector) {
        setIsSedeMenuOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsSedeMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const closeMobileSidebar = () => setIsMobileSidebarOpen(false);

  const toggleMobileUserMenu = () => {
    if (window.innerWidth > 880) return;
    setIsMobileUserMenuOpen((open) => !open);
  };

  const closeMobileUserMenu = () => setIsMobileUserMenuOpen(false);

  const handleSedeChange = (value) => {
    setSedeActiva(value ? Number(value) : null);
    setIsSedeMenuOpen(false);
  };

  const handleNavClick = () => {
    if (window.innerWidth <= 880) {
      closeMobileSidebar();
      closeMobileUserMenu();
    }
    try {
      if (document && document.activeElement) document.activeElement.blur();
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="app-shell">
      <div
        className={isMobileSidebarOpen ? 'app-shell__sidebar-overlay app-shell__sidebar-overlay--visible' : 'app-shell__sidebar-overlay'}
        onClick={closeMobileSidebar}
        aria-hidden="true"
      />

      <aside
        id="app-shell-sidebar"
        className={isMobileSidebarOpen ? 'app-shell__sidebar app-shell__sidebar--mobile-open' : 'app-shell__sidebar'}
      >
        <div className="app-shell__sidebar-mobile-header">
          <span className="app-shell__sidebar-mobile-title">Menú</span>
          <button type="button" className="app-shell__sidebar-close" onClick={closeMobileSidebar} aria-label="Cerrar menú">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const isActive = location.pathname === item.to;

            return (
              <Link
                key={item.to}
                to={item.to}
                className={isActive ? 'nav-link nav-link--active' : 'nav-link'}
                onClick={handleNavClick}
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
          <button
            type="button"
            className="app-shell__menu-toggle"
            onClick={() => setIsMobileSidebarOpen((open) => !open)}
            aria-label={isMobileSidebarOpen ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={isMobileSidebarOpen}
            aria-controls="app-shell-sidebar"
          >
            <span />
            <span />
            <span />
          </button>

          <div className="header-brand">
            <img src={logoImage} alt="Logo Summer Dent" className="header-brand__logo" />
            <div>
              <h2>Summer Dent</h2>
              {user && user.rol === 'superadmin' ? (
                <div className="header-desktop-sede sede-selector" ref={desktopSedeSelectorRef}>
                  <span className="header-desktop-sede__label">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12 22s6-5.3 6-11a6 6 0 1 0-12 0c0 5.7 6 11 6 11Z" fill="none" stroke="currentColor" strokeWidth="2" />
                      <circle cx="12" cy="11" r="2.5" fill="none" stroke="currentColor" strokeWidth="2" />
                    </svg>
                    <span>Sede:</span>
                  </span>
                  <div className="header-desktop-sede__control">
                    <button
                      type="button"
                      className="header-desktop-sede__trigger"
                      aria-haspopup="listbox"
                      aria-expanded={isSedeMenuOpen}
                      onClick={() => setIsSedeMenuOpen((open) => !open)}
                    >
                      <span className="header-desktop-sede__trigger-text">{activeSedeLabel}</span>
                    </button>
                    <svg className="header-desktop-sede__chevron" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {isSedeMenuOpen ? (
                      <div className="sede-selector__menu" role="listbox" aria-label="Selector de sedes">
                        {sedeOptions.map((option) => {
                          const isSelected = option.value === String(sedeActiva ?? '');

                          return (
                            <button
                              key={option.value || 'all'}
                              type="button"
                              role="option"
                              aria-selected={isSelected}
                              className={isSelected ? 'sede-selector__item sede-selector__item--active' : 'sede-selector__item'}
                              onClick={() => handleSedeChange(option.value)}
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            className="header-user-avatar header-user-avatar--mobile"
            aria-label={isMobileUserMenuOpen ? 'Cerrar menú de usuario' : 'Abrir menú de usuario'}
            aria-expanded={isMobileUserMenuOpen}
            onClick={toggleMobileUserMenu}
          >
            {userInitials}
          </button>
          {user && user.rol === 'superadmin' ? (
            <div className="header-mobile-sede sede-selector" ref={mobileSedeSelectorRef}>
              <span className="header-mobile-sede__label">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 22s6-5.3 6-11a6 6 0 1 0-12 0c0 5.7 6 11 6 11Z" fill="none" stroke="currentColor" strokeWidth="2" />
                  <circle cx="12" cy="11" r="2.5" fill="none" stroke="currentColor" strokeWidth="2" />
                </svg>
                <span>Sede:</span>
              </span>
              <div className="header-mobile-sede__control">
                <button
                  type="button"
                  className="header-mobile-sede__trigger"
                  aria-haspopup="listbox"
                  aria-expanded={isSedeMenuOpen}
                  onClick={() => setIsSedeMenuOpen((open) => !open)}
                >
                  <span className="header-mobile-sede__trigger-text">{activeSedeLabel}</span>
                </button>
                <svg className="header-mobile-sede__chevron" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {isSedeMenuOpen ? (
                  <div className="sede-selector__menu sede-selector__menu--mobile" role="listbox" aria-label="Selector de sedes">
                    {sedeOptions.map((option) => {
                      const isSelected = option.value === String(sedeActiva ?? '');

                      return (
                        <button
                          key={option.value || 'all'}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          className={isSelected ? 'sede-selector__item sede-selector__item--active' : 'sede-selector__item'}
                          onClick={() => handleSedeChange(option.value)}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className={isMobileUserMenuOpen ? 'header-user-block header-user-block--mobile-open' : 'header-user-block'}>
            <div className="header-user-info">
              <strong className="header-user-info__label">Usuario:</strong>
              <span className="header-user-info__name">{user?.nombre || 'Secretaria Principal'}</span>
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
