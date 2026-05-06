import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ErrorState from '../../components/feedback/ErrorState';
import LoadingState from '../../components/feedback/LoadingState';
import { quickActions } from '../../lib/dashboardData';
import { fetchDashboardSnapshot } from '../../services/api/dashboard';

const statIcons = {
  'citas-hoy': 'calendar',
  'total-ingresos': 'trend-up',
  'total-egresos': 'trend-down',
  balance: 'money'
};

const quickActionRoutes = {
  'Gestionar Pacientes': '/pacientes',
  'Ver Citas': '/citas',
  'Registrar Ingreso': '/ingresos',
  'Revisar Inventario': '/inventario'
};

const StatIcon = ({ type }) => {
  const common = { width: 30, height: 30, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2' };
  if (type === 'calendar') return <svg {...common}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
  if (type === 'trend-up') return <svg {...common}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>;
  if (type === 'trend-down') return <svg {...common}><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>;
  return <svg {...common}><path d="M12 1v22"/><path d="M17 5H9a3 3 0 0 0 0 6h6a3 3 0 0 1 0 6H7"/></svg>;
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('hoy'); // 'hoy' | 'rango' | 'acumulado'
  const today = (() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
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
      id: 'total-egresos',
      title: 'Total Egresos',
      value: currency.format(data?.summary?.totalEgresos ?? 0)
    },
    {
      id: 'balance',
      title: 'Balance',
      value: currency.format(data?.summary?.balance ?? 0)
    }
  ];

  const nextAppointments = data?.appointments ?? [];
  const todaysAppointments = data?.todaysAppointments ?? [];

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
    <section className="dashboard-grid">
      <div className="dashboard-topbar">
        <div className="dashboard-title">
          <h1>Dashboard Principal</h1>
          <p>Resumen general del consultorio</p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className={`seg-btn ${mode === 'hoy' ? 'is-active' : ''}`} onClick={() => { setMode('hoy'); setDesde(today); setHasta(today); }}>Hoy</button>
            <button className={`seg-btn ${mode === 'rango' ? 'is-active' : ''}`} onClick={() => setMode('rango')}>Rango</button>
            <button className={`seg-btn ${mode === 'acumulado' ? 'is-active' : ''}`} onClick={() => { setMode('acumulado'); setDesde(''); setHasta(today); }}>Acumulado</button>
          </div>
          {mode === 'rango' && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
              <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
            </div>
          )}
        </div>
      </div>

      <div className="summary-grid">
        {isLoading
          ? [1, 2, 3, 4].map((item) => (
              <article key={item} className="stat-card">
                <LoadingState lines={2} />
              </article>
            ))
          : dashboardSummary.map((item) => (
              <article key={item.id} className="stat-card">
                <div>
                  <p className="stat-card__title">{item.title}</p>
                  <p className="stat-card__value">{item.value}</p>
                </div>
                <div className={`stat-card__icon stat-card__icon--${item.id}`}>
                  <StatIcon type={statIcons[item.id]} />
                </div>
              </article>
            ))}
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
              {action}
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
          <h3>Próximas Citas</h3>

          <div className="appointments-list">
            {isLoading ? (
              <LoadingState lines={3} />
            ) : nextAppointments.length === 0 ? (
              <p className="dashboard-empty">No hay citas próximas registradas.</p>
            ) : (
              nextAppointments.map((appointment) => (
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
