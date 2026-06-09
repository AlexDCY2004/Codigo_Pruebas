import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ErrorState from '../../components/feedback/ErrorState';
import LoadingState from '../../components/feedback/LoadingState';
import { quickActions } from '../../lib/dashboardData';
import { fetchDashboardSnapshot } from '../../services/api/dashboard';
import { useEffect } from 'react';
import CajaMensualPage from '../../pages/finanzas/CajaMensualPage';
import { fetchCajaMensual } from '../../services/api/cajaMensual';
import { fetchMovimientosFinanzas } from '../../services/api/movimientoFinanzas';
import { useAuthStore } from '../../store/authStore';
import { createMovimientoFinanzas } from '../../services/api/movimientoFinanzas';
import Button from '../../components/ui/Button';

const statIcons = {
  'caja-mensual': 'money',
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

  const QuickIcon = ({ action }) => {
    const common = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2' };
    if (action.includes('Pacientes')) return <svg {...common}><circle cx="12" cy="8" r="3"/><path d="M5 20c1.5-4 6-6 7-6s5.5 2 7 6"/></svg>;
    if (action.includes('Citas')) return <svg {...common}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
    if (action.includes('Ingreso')) return <svg {...common}><path d="M12 5v14"/><path d="M19 12h-14"/></svg>;
    if (action.includes('Inventario')) return <svg {...common}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>;
    return <svg {...common}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/></svg>;
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
  const [upcomingMode, setUpcomingMode] = useState('total'); // 'total' | 'manana' | 'proximo-mes'
  const [isCajaModalOpen, setIsCajaModalOpen] = useState(false);
  const now = new Date();
  const [currentAnio] = useState(now.getFullYear());
  const [selectedMes, setSelectedMes] = useState(now.getMonth() + 1);
  const queryClient = useQueryClient();
  const [isQuickEgresoOpen, setIsQuickEgresoOpen] = useState(false);
  const [quickMonto, setQuickMonto] = useState('');
  const [quickDescripcion, setQuickDescripcion] = useState('');
  const [quickMetodo, setQuickMetodo] = useState('efectivo');
  const [isSubmittingQuick, setIsSubmittingQuick] = useState(false);

  const sedeActiva = useAuthStore((s) => s.sedeActiva);

  const { data: cajaData } = useQuery({
    queryKey: ['caja-mensual-dashboard', sedeActiva, currentAnio, selectedMes],
    queryFn: () => fetchCajaMensual({ anio: currentAnio, mes: selectedMes, sede_id: sedeActiva }),
    staleTime: 1000 * 60 * 2
  });

  // Fallback: if no caja record exists for the month, compute efectivo from movimientos
  const { data: movimientosForMonth = [] } = useQuery({
    queryKey: ['caja-mensual-fallback', sedeActiva, currentAnio, selectedMes],
    queryFn: async () => {
      const month = String(selectedMes).padStart(2, '0');
      const desde = `${currentAnio}-${month}-01`;
      const lastDay = new Date(currentAnio, selectedMes, 0).getDate();
      const hasta = `${currentAnio}-${month}-${String(lastDay).padStart(2, '0')}`;
      const params = { desde, hasta };
      if (sedeActiva !== null && typeof sedeActiva !== 'undefined') params.sede_id = sedeActiva;
      const rows = await fetchMovimientosFinanzas(params);
      return Array.isArray(rows) ? rows : [];
    },
    enabled: !cajaData,
    staleTime: 1000 * 30
  });

  const cajaFallbackSaldo = (() => {
    if (!movimientosForMonth || movimientosForMonth.length === 0) return null;
    // counting rule: include movimientos with metodo_pago containing 'deposito' or equal 'efectivo'
    let totalIngresos = 0;
    let totalEgresos = 0;
    movimientosForMonth.forEach((mv) => {
      const metodo = String(mv.metodo_pago || '').toLowerCase();
      if (!(metodo.includes('deposito') || metodo === 'efectivo')) return; // ignore non-cash methods
      const monto = Number(mv.monto || 0);
      if (String(mv.tipo) === 'ingreso') totalIngresos += monto;
      else if (String(mv.tipo) === 'egreso') totalEgresos += monto;
    });
    return Number((totalIngresos - totalEgresos).toFixed(2));
  })();

  // inline edit removed; keep code simple

  const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
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
      id: 'caja-mensual',
      title: 'Caja Mensual',
      value: currency.format((cajaData && (cajaData.saldo_final !== null && cajaData.saldo_final !== undefined)) ? cajaData.saldo_final : (cajaFallbackSaldo !== null ? cajaFallbackSaldo : 0))
    },
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
          ? [1, 2, 3, 4].map((item) => (
              <article key={item} className="stat-card">
                <LoadingState lines={2} />
              </article>
            ))
          : (() => {
              const others = dashboardSummary.filter((it) => it.id !== 'caja-mensual');
              const firstFour = others.slice(0, 4);
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

      {/* Full width Caja Mensual card below the four summary cards */}
      <div className="caja-full">
        <article className="stat-card stat-card--clickable caja-full__card" style={{ cursor: 'pointer' }}>
          <div className="caja-full__header">
            <p style={{ fontWeight: 700, fontSize: '0.85rem' }} className="stat-card__title">Efectivo Mensual</p>
          </div>

          <div className="caja-full__selector-row">
            <select className="stat-card__month-select ui-btn ui-btn--secondary stat-card__small-btn" value={selectedMes} onChange={(e) => setSelectedMes(Number(e.target.value))}>
              {MONTHS.map((mName, idx) => (
                <option key={mName} value={idx + 1}>{mName}</option>
              ))}
            </select>
            <span style={{ marginLeft: 12, fontWeight: 700, color: '#1d3354' }}>{currentAnio}</span>
          </div>

          <div className="caja-full__body">
            <div className="caja-full__totalBlock">
              <div style={{ fontSize: 12, color: '#53657f', fontWeight: 700 }}>Total Efectivo disponible</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <p className="stat-card__value" style={{ margin: 0 }}>{currency.format(cajaData?.saldo_final ?? 0)}</p>
                  <button
                    type="button"
                    className="stat-card__small-btn"
                    aria-label="Registrar egreso rápido"
                    title="Registrar egreso rápido"
                    onClick={() => setIsQuickEgresoOpen((v) => !v)}
                    style={{ padding: '6px 8px' }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18" aria-hidden="true">
                      <path d="M17 1l4 4-4 4" />
                      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                      <path d="M7 23l-4-4 4-4" />
                      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                    </svg>
                  </button>
                </div>
                {/* Quick egreso opens modal (handled below) */}
            </div>

            <div className="caja-full__stats">
              <div className="caja-full__stat">
                <div className="caja-full__label">Efectivo Inicial</div>
                <div className="caja-full__amount">{currency.format(cajaData?.saldo_inicial ?? 0)}</div>
              </div>
              <div className="caja-full__stat">
                <div className="caja-full__label">Ingresos Totales</div>
                <div className="caja-full__amount caja-full__amount--positive">{currency.format(cajaData?.total_ingresos ?? 0)}</div>
              </div>
              <div className="caja-full__stat">
                <div className="caja-full__label">Egresos Totales</div>
                <div className="caja-full__amount caja-full__amount--negative">{currency.format(cajaData?.total_egresos ?? 0)}</div>
              </div>
            </div>

            <div className="caja-full__actions">
              <Button variant="secondary" onClick={() => setIsCajaModalOpen(true)} className="stat-card__small-btn">Editar saldo</Button>
            </div>
          </div>
        </article>
      </div>

      <div className="quick-access">
        <h2>Accesos Rápidos</h2>
        <div className="quick-access__buttons">
          {quickActions.map((action, index) => (
            <button
              key={action}
              type="button"
              className={`quick-btn quick-btn--${index + 1}`}
                onClick={() => {
                  if (action === 'Caja Mensual') return setIsCajaModalOpen(true);
                  return navigate(quickActionRoutes[action] || '/dashboard');
                }}
            >
              <span className="quick-btn__icon"><QuickIcon action={action} /></span>
              <span className="quick-btn__label">{action}</span>
            </button>
          ))}
        </div>
      </div>

        {isCajaModalOpen ? (
          <div className="modal-overlay" onClick={() => setIsCajaModalOpen(false)}>
              <div className="modal-content modal-content--large" onClick={(e) => e.stopPropagation()}>
              <button type="button" className="modal-close" onClick={() => setIsCajaModalOpen(false)}>✕</button>
              <CajaMensualPage onClose={() => setIsCajaModalOpen(false)} initialAnio={currentAnio} initialMes={selectedMes} />
            </div>
          </div>
        ) : null}

        {isQuickEgresoOpen ? (
          <div className="modal-overlay" onClick={() => { if (!isSubmittingQuick) setIsQuickEgresoOpen(false); }}>
            <div className="modal-content modal-content--spacious" style={{ maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Registrar Egreso Rápido</h2>
                <button type="button" className="modal-close" onClick={() => { if (!isSubmittingQuick) setIsQuickEgresoOpen(false); }}>✕</button>
              </div>
              <div style={{ display: 'grid', gap: 12, padding: '0.5rem 0 0 0' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }} className="ui-field">
                  <span className="ui-field__label">Monto</span>
                  <input type="number" min="0" step="0.01" placeholder="Monto" value={quickMonto} onChange={(e) => setQuickMonto(e.target.value)} className="ui-input" />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }} className="ui-field">
                  <span className="ui-field__label">Descripción (opcional)</span>
                  <input type="text" placeholder="Descripción" value={quickDescripcion} onChange={(e) => setQuickDescripcion(e.target.value)} className="ui-input" />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }} className="ui-field">
                  <span className="ui-field__label">Método</span>
                  <select value={quickMetodo} onChange={(e) => setQuickMetodo(e.target.value)} className="ui-input">
                    <option value="efectivo">Efectivo</option>
                    <option value="deposito">Depósito bancario</option>
                  </select>
                </label>
                <div className="modal-footer">
                  <button type="button" className="btn-modal-cancel" onClick={() => { if (!isSubmittingQuick) setIsQuickEgresoOpen(false); }} disabled={isSubmittingQuick}>Cancelar</button>
                  <button
                    type="button"
                    className="btn-modal-save"
                    onClick={async () => {
                      const montoNum = Number(Number(quickMonto || 0));
                      if (!montoNum || montoNum <= 0) return alert('Ingresa un monto válido');
                      try {
                        setIsSubmittingQuick(true);
                        const payload = {
                          tipo: 'egreso',
                          monto: Number(montoNum.toFixed(2)),
                          descripcion: quickDescripcion || null,
                          metodo_pago: quickMetodo,
                          fecha: today
                        };
                        if (sedeActiva) payload.sede_id = sedeActiva;
                        await createMovimientoFinanzas(payload);
                        queryClient.invalidateQueries({ queryKey: ['caja-mensual-dashboard', sedeActiva, currentAnio, selectedMes] });
                        queryClient.invalidateQueries({ queryKey: ['egresos', sedeActiva] });
                        queryClient.invalidateQueries({ queryKey: ['dashboard-snapshot'] });
                        setQuickMonto('');
                        setQuickDescripcion('');
                        setQuickMetodo('efectivo');
                        setIsQuickEgresoOpen(false);
                      } catch (err) {
                        console.error('Error creando egreso rápido:', err);
                        alert('No se pudo registrar el egreso.');
                      } finally {
                        setIsSubmittingQuick(false);
                      }
                    }}
                    disabled={isSubmittingQuick}
                  >{isSubmittingQuick ? 'Registrando...' : 'Registrar'}</button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

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