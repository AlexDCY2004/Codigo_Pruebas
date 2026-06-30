import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ErrorState from '../../components/feedback/ErrorState';
import LoadingState from '../../components/feedback/LoadingState';
import { quickActions } from '../../lib/dashboardData';
import { fetchDashboardSnapshot } from '../../services/api/dashboard';
import { useEffect } from 'react';
import Button from '../../components/ui/Button';

const statIcons = {
  'citas-hoy': 'calendar',
  'total-ingresos': 'trend-up',
  'total-doctores': 'users'
};

const quickActionRoutes = {
  'Pacientes': '/pacientes',
  'Citas': '/citas',
  'Doctores': '/doctores',
  'Tratamientos': '/tratamientos',
  'Financiero': '/financiero'
};

  const QuickIcon = ({ action }) => {
    const common = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2' };
    if (action.includes('Pacientes')) return <svg {...common}><circle cx="12" cy="8" r="3"/><path d="M5 20c1.5-4 6-6 7-6s5.5 2 7 6"/></svg>;
    if (action.includes('Citas')) return <svg {...common}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
    if (action.includes('Doctores')) return <svg {...common}><path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z"/><circle cx="12" cy="11" r="3"/><path d="M9 17c.5-1 1.5-1.5 3-1.5s2.5.5 3 1.5"/></svg>;
    if (action.includes('Tratamientos')) return <svg {...common}><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></svg>;
    if (action.includes('Financiero')) return <svg {...common}><line x1="12" y1="2" x2="12" y2="22"/><path d="M17 7.5c0-1.5-1.5-2.5-4-2.5s-4 1-4 2.5 1.5 2.5 4 2.5 4 1 4 2.5-1.5 2.5-4 2.5-4-1-4-2.5"/></svg>;
    return <svg {...common}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/></svg>;
  };

const StatIcon = ({ type }) => {
  const common = { width: 30, height: 30, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2' };
  if (type === 'calendar') return <svg {...common}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
  if (type === 'trend-up') return <svg {...common}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>;
  if (type === 'trend-down') return <svg {...common}><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>;
  if (type === 'users') return <svg {...common}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
  return <svg {...common}><path d="M12 1v22"/><path d="M17 5H9a3 3 0 0 0 0 6h6a3 3 0 0 1 0 6H7"/></svg>;
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('hoy'); // 'hoy' | 'rango' | 'acumulado'
  const [upcomingMode, setUpcomingMode] = useState('total'); // 'total' | 'manana' | 'proximo-mes'
  const queryClient = useQueryClient();

  // inline edit removed; keep code simple
  const today = (() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  })();
  const tomorrow = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  })();
  const nextMonthKey = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  })();
  const [desde, setDesde] = useState(today);
  const [hasta, setHasta] = useState(today);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard-snapshot', mode, desde, hasta],
    queryFn: () => {
      // prepare params based on mode
      if (mode === 'hoy') return fetchDashboardSnapshot({ desde: today, hasta: today });
      if (mode === 'rango') return fetchDashboardSnapshot({ desde: desde || undefined, hasta: hasta || undefined });
      // acumulado
      return fetchDashboardSnapshot({ hasta: today });
    }
  });

  useEffect(() => {
    // Reserved: previously fetched sedes here for inline selector. Now the selector
    // lives in AppShell and fetches its own sedes. Keep this effect empty to avoid
    // accidental network calls while preserving structure for future changes.
    return undefined;
  }, []);

  const currency = new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  });

  const dashboardSummary = [
    {
      id: 'citas-hoy',
      title: 'Citas de Hoy',
      value: data?.summary?.citasHoy ?? 0
    },
    {
      id: 'total-ingresos',
      title: 'Total Ingresos',
      value: currency.format(data?.summary?.totalIngresos ?? 0)
    },
    {
      id: 'total-doctores',
      title: 'Doctores Activos',
      value: data?.summary?.totalDoctoresActivos ?? 0
    }
  ];

  const nextAppointments = data?.appointments ?? [];
  const todaysAppointments = data?.todaysAppointments ?? [];
  const upcomingAppointments = nextAppointments.filter((appointment) => {
    const appointmentDate = String(appointment?.date || '');

    if (upcomingMode === 'manana') {
      return appointmentDate === tomorrow;
    }

    if (upcomingMode === 'proximo-mes') {
      return appointmentDate.startsWith(nextMonthKey);
    }

    return true;
  });

  const upcomingEmptyMessage = (() => {
    if (upcomingMode === 'manana') return 'No hay citas para mañana.';
    if (upcomingMode === 'proximo-mes') return 'No hay citas para el próximo mes.';
    return 'No hay citas próximas registradas.';
  })();

  if (isError) {
    return (
      <ErrorState
        title="No se pudo cargar el dashboard"
        message="Verifica la sesión o la conexion con el backend e intenta nuevamente."
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <section className={`dashboard-grid mode-${mode}`}>
      <div className="dashboard-topbar">
        <div className="dashboard-title">
          <h1>Dashboard Principal</h1>
          <p>Resumen general del consultorio</p>
        </div>
        <div className="dashboard-controls">
          <div className="segmented-buttons">
            <button
              className={`seg-btn seg-btn--hoy ${mode === 'hoy' ? 'is-active' : ''}`}
              aria-pressed={mode === 'hoy'}
              onClick={() => { setMode('hoy'); setDesde(today); setHasta(today); }}
            >
              Hoy
            </button>
            <button
              className={`seg-btn seg-btn--rango ${mode === 'rango' ? 'is-active' : ''}`}
              aria-pressed={mode === 'rango'}
              onClick={() => setMode('rango')}
            >
              Rango
            </button>
            <button
              className={`seg-btn seg-btn--acumulado ${mode === 'acumulado' ? 'is-active' : ''}`}
              aria-pressed={mode === 'acumulado'}
              onClick={() => { setMode('acumulado'); setDesde(''); setHasta(today); }}
            >
              Total
            </button>
          </div>
          {mode === 'rango' && (
            <>
            <div className="dashboard-range-picker">
              <label className="dashboard-range-field">
                <span>Desde</span>
                <input
                  type="date"
                  value={desde}
                  onChange={(e) => setDesde(e.target.value)}
                  className="dashboard-date-input"
                />
              </label>
              <label className="dashboard-range-field">
                <span>Hasta</span>
                <input
                  type="date"
                  value={hasta}
                  onChange={(e) => setHasta(e.target.value)}
                  className="dashboard-date-input"
                />
              </label>
            </div>
            </>
          )}

          {/* selector removed from dashboard topbar - now only under Summer Dent header */}
        </div>
      </div>

      <div className="summary-grid">
        {isLoading
          ? [1, 2, 3].map((item) => (
              <article key={item} className="stat-card">
                <LoadingState lines={2} />
              </article>
            ))
          : (() => {
              const firstFour = dashboardSummary.slice(0, 4);
              return firstFour.map((item) => (
                <article key={item.id} className="stat-card">
                  <div>
                    <p className="stat-card__title">{item.title}</p>
                    <p className="stat-card__value">{item.value}</p>
                  </div>
                  <div className={`stat-card__icon stat-card__icon--${item.id}`}>
                    <StatIcon type={statIcons[item.id]} />
                  </div>
                </article>
              ));
            })()}
      </div>

      <div className="quick-access">
        <h2>Accesos Rápidos</h2>
        <div className="quick-access__buttons">
          {quickActions.map((action, index) => (
            <button
              key={action}
              type="button"
              className={`quick-btn quick-btn--${index + 1}`}
                onClick={() => navigate(quickActionRoutes[action] || '/dashboard')}
            >
              <span className="quick-btn__icon"><QuickIcon action={action} /></span>
              <span className="quick-btn__label">{action}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="dashboard-panels">
        <article className="panel-card">
          <h3>Citas de Hoy</h3>

          <div className="appointments-list">
            {isLoading ? (
              <LoadingState lines={3} />
            ) : todaysAppointments.length === 0 ? (
              <p className="dashboard-empty">No hay citas para hoy.</p>
            ) : (
              todaysAppointments.map((appointment) => (
                <div key={`today-${appointment.id}`} className="appointment-item">
                  <div>
                    <p className="appointment-id">{appointment.patientName || 'Paciente sin nombre'}</p>
                    <span>
                      {appointment.date} - {appointment.start} a {appointment.end}
                    </span>
                  </div>
                  <span
                    className={
                      appointment.status === 'confirmada'
                        ? 'appointment-status appointment-status--ok appointment-status--today'
                        : 'appointment-status appointment-status--pending appointment-status--today'
                    }
                  >
                    {appointment.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="panel-card">
          <div className="panel-card__header panel-card__header--appointments">
            <h3>Próximas Citas</h3>

            <div className="segmented-buttons dashboard-appointments-segmented" aria-label="Filtros de próximas citas">
              <button
                type="button"
                className={`seg-btn seg-btn--hoy ${upcomingMode === 'total' ? 'is-active' : ''}`}
                aria-pressed={upcomingMode === 'total'}
                onClick={() => setUpcomingMode('total')}
              >
                Total
              </button>
              <button
                type="button"
                className={`seg-btn seg-btn--rango ${upcomingMode === 'manana' ? 'is-active' : ''}`}
                aria-pressed={upcomingMode === 'manana'}
                onClick={() => setUpcomingMode('manana')}
              >
                Mañana
              </button>
              <button
                type="button"
                className={`seg-btn seg-btn--acumulado ${upcomingMode === 'proximo-mes' ? 'is-active' : ''}`}
                aria-pressed={upcomingMode === 'proximo-mes'}
                onClick={() => setUpcomingMode('proximo-mes')}
              >
                Próximo mes
              </button>
            </div>
          </div>

          <div className="appointments-list">
            {isLoading ? (
              <LoadingState lines={3} />
            ) : upcomingAppointments.length === 0 ? (
              <p className="dashboard-empty">{upcomingEmptyMessage}</p>
            ) : (
              upcomingAppointments.map((appointment) => (
                <div key={appointment.id} className="appointment-item">
                  <div>
                    <p className="appointment-id">{appointment.patientName || 'Paciente sin nombre'}</p>
                    <span>
                      {appointment.date} - {appointment.start} a {appointment.end}
                    </span>
                  </div>
                  <span
                    className={
                      appointment.status === 'confirmada'
                        ? 'appointment-status appointment-status--ok'
                        : 'appointment-status appointment-status--pending'
                    }
                  >
                    {appointment.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </article>
      </div>
    </section>
  );
}