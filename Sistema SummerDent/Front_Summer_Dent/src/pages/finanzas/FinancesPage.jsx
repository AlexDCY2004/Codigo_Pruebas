import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Eye } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip
} from 'recharts';
import { fetchMovimientosFinanzas } from '../../services/api/movimientoFinanzas';
import ErrorState from '../../components/feedback/ErrorState';
import Button from '../../components/ui/Button';

const PERIODS = {
  diario: 'diario',
  semanal: 'semanal',
  mensual: 'mensual'
};

const MOVIMIENTOS_POR_PAGINA = 15;

const METODO_PAGO_OPTIONS = [
  { value: 'todos', label: 'Todos métodos' },
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'tarjeta', label: 'Tarjeta' }
];

const formatCurrency = (value) => new Intl.NumberFormat('es-EC', {
  style: 'currency',
  currency: 'USD'
}).format(Number(value ?? 0));

const formatDate = (value) => {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleDateString('es-EC', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
};

const toLocalDateKey = (value) => {
  if (!value) return null;
  // if value already in YYYY-MM-DD format, return as-is
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const getDoctorLabel = (movimiento) => {
  if (movimiento.doctor?.nombre) {
    return movimiento.doctor.nombre;
  }

  return '-';
};

const getMovementLabel = (movimiento) => (movimiento.tipo === 'egreso' ? 'Egreso' : 'Ingreso');

//const getMovementSign = (tipo) => (tipo === 'egreso' ? '-' : '+');

const getMovementClass = (tipo) => (tipo === 'egreso' ? 'movement-row--expense' : 'movement-row--income');

const getTypeBadgeClass = (tipo) => (tipo === 'egreso' ? 'finance-type-badge--expense' : 'finance-type-badge--income');

const formatSignedCurrency = (tipo, value) => {
  const amount = Math.abs(Number(value ?? 0));
  const symbol = tipo === 'egreso' ? '-' : '+';
  return `${symbol}${formatCurrency(amount)}`;
};

const groupLabelByPeriod = (dateKey, period) => {
  if (!dateKey) return 'Sin fecha';

  const date = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(date.getTime())) return 'Sin fecha';

  if (period === PERIODS.diario) {
    return date.toLocaleDateString('es-EC', {
      day: '2-digit',
      month: 'short'
    });
  }

  if (period === PERIODS.semanal) {
    const start = new Date(date);
    start.setDate(start.getDate() - start.getDay());
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    // Use short month names to make week ranges clearer (e.g. "25-may - 31-may")
    return `${start.toLocaleDateString('es-EC', { day: '2-digit', month: 'short' })} - ${end.toLocaleDateString('es-EC', { day: '2-digit', month: 'short' })} ${start.getFullYear()}`;
  }

  return date.toLocaleDateString('es-EC', {
    year: 'numeric',
    month: 'short'
  });
};

const getGroupKeyByPeriod = (dateKey, period) => {
  if (!dateKey) return 'sin-fecha';

  const date = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(date.getTime())) return 'sin-fecha';

  if (period === PERIODS.diario) {
    return dateKey;
  }

  if (period === PERIODS.semanal) {
    const start = new Date(date);
    start.setDate(start.getDate() - start.getDay());
    const y = start.getFullYear();
    const m = String(start.getMonth() + 1).padStart(2, '0');
    const d = String(start.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const parseGroupKeyToDate = (groupKey, period) => {
  if (!groupKey) return new Date(0);
  try {
    // Guard against placeholder keys like 'sin-fecha' or malformed input
    if (period === PERIODS.mensual) {
      // expect YYYY-MM
      if (!/^[0-9]{4}-[0-1][0-9]$/.test(groupKey)) return new Date(0);
      return new Date(`${groupKey}-01T00:00:00`);
    }

    // diario or semanal expect YYYY-MM-DD
    if (!/^[0-9]{4}-[0-1][0-9]-[0-3][0-9]$/.test(groupKey)) return new Date(0);
    return new Date(`${groupKey}T00:00:00`);
  } catch {
    return new Date(0);
  }
};

export default function FinancesPage() {
  const [period, setPeriod] = useState(PERIODS.mensual);
  const [searchTerm, setSearchTerm] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [typeFilter] = useState('todos');
  const [metodoFilter, setMetodoFilter] = useState('todos');
  const [isMetodoMenuOpen, setIsMetodoMenuOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedMovimientoId, setExpandedMovimientoId] = useState(null);
  const [selectedMovimiento, setSelectedMovimiento] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const metodoSelectorRef = useRef(null);

  const { data: movimientos = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['movimientos-financieros', desde, hasta],
    queryFn: () => fetchMovimientosFinanzas({ desde: desde || undefined, hasta: hasta || undefined })
  });

  const filteredMovimientos = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return movimientos.filter((movimiento) => {
      const matchesType = typeFilter === 'todos' || movimiento.tipo === typeFilter;
      const matchesMetodo = metodoFilter === 'todos' || movimiento.metodo_pago === metodoFilter;

      const fechaKey = toLocalDateKey(movimiento.fecha);
      let matchesDate = true;
      if (desde && hasta) matchesDate = fechaKey >= desde && fechaKey <= hasta;
      else if (desde) matchesDate = fechaKey >= desde;
      else if (hasta) matchesDate = fechaKey <= hasta;

      const searchableFields = [
        toLocalDateKey(movimiento.fecha),
        toLocalDateKey(movimiento.created_at),
        movimiento.id_doctor,
        movimiento.tipo,
        movimiento.monto,
        movimiento.descripcion,
        getDoctorLabel(movimiento)
      ]
        .filter(Boolean)
        .map((field) => String(field).toLowerCase());

      const matchesSearch = !normalizedSearch || searchableFields.some((field) => field.includes(normalizedSearch));

      return matchesType && matchesDate && matchesSearch && matchesMetodo;
    });
  }, [desde, hasta, movimientos, searchTerm, typeFilter, metodoFilter]);

  const totalIngresos = useMemo(
    () => filteredMovimientos
      .filter((movimiento) => movimiento.tipo === 'ingreso')
      .reduce((acc, movimiento) => acc + Number(movimiento.monto || 0), 0),
    [filteredMovimientos]
  );

  const totalEgresos = useMemo(
    () => filteredMovimientos
      .filter((movimiento) => movimiento.tipo === 'egreso')
      .reduce((acc, movimiento) => acc + Number(movimiento.monto || 0), 0),
    [filteredMovimientos]
  );

  const balance = totalIngresos - totalEgresos;

  const chartData = useMemo(() => {
    const buckets = new Map();

    filteredMovimientos.forEach((movimiento) => {
      const keyDate = toLocalDateKey(movimiento.fecha);
      const groupKey = getGroupKeyByPeriod(keyDate, period);

      if (!buckets.has(groupKey)) {
        buckets.set(groupKey, {
          label: groupLabelByPeriod(keyDate, period),
          ingresos: 0,
          egresos: 0
        });
      }

      const bucket = buckets.get(groupKey);
      const amount = Number(movimiento.monto || 0);

      if (movimiento.tipo === 'egreso') {
        bucket.egresos += amount;
      } else {
        bucket.ingresos += amount;
      }
    });

    // Sort buckets by their group date to ensure chronological order on the chart
    const sorted = Array.from(buckets.entries()).sort((a, b) => {
      const aDate = parseGroupKeyToDate(a[0], period);
      const bDate = parseGroupKeyToDate(b[0], period);
      return aDate - bDate;
    }).map(([, value]) => ({ ...value, balance: value.ingresos - value.egresos }));

    return sorted;
  }, [filteredMovimientos, period]);

  const totalPages = Math.max(1, Math.ceil(filteredMovimientos.length / MOVIMIENTOS_POR_PAGINA));

  const paginatedMovimientos = useMemo(() => {
    const startIndex = (currentPage - 1) * MOVIMIENTOS_POR_PAGINA;
    return filteredMovimientos.slice(startIndex, startIndex + MOVIMIENTOS_POR_PAGINA);
  }, [currentPage, filteredMovimientos]);

  const toggleMovimientoDetails = (movimientoId) => {
    setExpandedMovimientoId((currentId) => (currentId === movimientoId ? null : movimientoId));
  };

  const openMovimientoDetail = (movimiento) => {
    setSelectedMovimiento(movimiento);
    setIsDetailOpen(true);
  };

  const closeMovimientoDetail = () => {
    setIsDetailOpen(false);
    setSelectedMovimiento(null);
  };

  const renderMovimientoDetails = (movimiento) => [
    { label: 'Doctor', value: getDoctorLabel(movimiento) },
    { label: 'Tipo', value: getMovementLabel(movimiento) },
    { label: 'Método de pago', value: movimiento.metodo_pago || '-' },
    { label: 'Monto', value: formatSignedCurrency(movimiento.tipo, movimiento.monto) },
    { label: 'Descripción', value: movimiento.descripcion || '-' },
    { label: 'Fecha Registro', value: formatDate(movimiento.created_at) }
  ];

  useEffect(() => {
    const id = setTimeout(() => setCurrentPage(1), 0);
    return () => clearTimeout(id);
  }, [desde, hasta, searchTerm, metodoFilter]);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    const handlePointerDown = (event) => {
      if (!metodoSelectorRef.current?.contains(event.target)) {
        setIsMetodoMenuOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsMetodoMenuOpen(false);
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

  const activeMetodoLabel = METODO_PAGO_OPTIONS.find((option) => option.value === metodoFilter)?.label || 'Todos métodos';

  const handleMetodoFilterChange = (value) => {
    setMetodoFilter(value);
    setIsMetodoMenuOpen(false);
  };

  const renderChartTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;

    const ingresos = payload.find((item) => item.dataKey === 'ingresos')?.value ?? 0;
    const egresos = payload.find((item) => item.dataKey === 'egresos')?.value ?? 0;
    const balanceValue = ingresos - egresos;
    const balanceText = balanceValue === 0
      ? formatCurrency(0)
      : formatSignedCurrency(balanceValue > 0 ? 'ingreso' : 'egreso', Math.abs(balanceValue));

    return (
      <div className="finance-chart-tooltip">
        <div className="finance-chart-tooltip__title">{label}</div>
        <div className="finance-chart-tooltip__row finance-chart-tooltip__row--income">
          <span>Ingresos</span>
          <strong>{formatCurrency(ingresos)}</strong>
        </div>
        <div className="finance-chart-tooltip__row finance-chart-tooltip__row--expense">
          <span>Egresos</span>
          <strong>{formatCurrency(egresos)}</strong>
        </div>
        <div className="finance-chart-tooltip__row finance-chart-tooltip__row--balance">
          <span>Balance</span>
          <strong>{balanceText}</strong>
        </div>
      </div>
    );
  };

  useEffect(() => {
    const id = setTimeout(() => setCurrentPage((page) => Math.min(page, totalPages)), 0);
    return () => clearTimeout(id);
  }, [totalPages]);

  if (isError) {
    return <ErrorState onRetry={refetch} />;
  }

  return (
    <div className="page-container finance-page">
      <div className="page-header page-header--finance">
        <div>
          <h1>Módulo Financiero</h1>
          <p>Análisis y resumen financiero del consultorio</p>
        </div>
      </div>

      <div className="finance-summary-grid finance-summary-grid--overview">
        <section className="finance-total-card finance-total-card--income">
          <span>Total Ingresos</span>
          <strong>{formatCurrency(totalIngresos)}</strong>
        </section>

        <section className="finance-total-card finance-total-card--expense">
          <span>Total Egresos</span>
          <strong>{formatCurrency(totalEgresos)}</strong>
        </section>

        <section className="finance-total-card finance-total-card--balance">
          <span>Balance</span>
          <strong>{formatCurrency(balance)}</strong>
        </section>
      </div>

      <section className="finance-chart-card">
        <div className="finance-chart-card__header">
          <div className="finance-chart-card__header-left">
            <h2>Resumen</h2>
            <div className="finance-chart__legend finance-chart__legend--header">
              <span><i className="legend-dot legend-dot--income" />Ingresos</span>
              <span><i className="legend-dot legend-dot--expense" />Egresos</span>
              <span><i className="legend-dot legend-dot--balance" />Balance</span>
            </div>
            <div className={balance >= 0 ? 'finance-chart__balance-pill finance-chart__balance-pill--positive' : 'finance-chart__balance-pill finance-chart__balance-pill--negative'}>
              <span>Balance neto del periodo</span>
              <strong>{balance === 0 ? formatCurrency(0) : formatSignedCurrency(balance > 0 ? 'ingreso' : 'egreso', Math.abs(balance))}</strong>
            </div>
          </div>
          <div className="finance-period-toggle" role="tablist" aria-label="Periodo del gráfico financiero">
            <button
              type="button"
              className={period === PERIODS.diario ? 'toggle-pill toggle-pill--active' : 'toggle-pill'}
              onClick={() => setPeriod(PERIODS.diario)}
            >
              Diario
            </button>
            <button
              type="button"
              className={period === PERIODS.semanal ? 'toggle-pill toggle-pill--active' : 'toggle-pill'}
              onClick={() => setPeriod(PERIODS.semanal)}
            >
              Semanal
            </button>
            <button
              type="button"
              className={period === PERIODS.mensual ? 'toggle-pill toggle-pill--active' : 'toggle-pill'}
              onClick={() => setPeriod(PERIODS.mensual)}
            >
              Mensual
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="finance-chart-skeleton" />
        ) : chartData.length === 0 ? (
          <div className="empty-state finance-empty-state">
            <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📊</div>
            <h3>No hay datos suficientes para el gráfico</h3>
            <p>Agrega movimientos o cambia los filtros para ver la evolución financiera.</p>
          </div>
        ) : (
          <div className="finance-chart">
            <div className="finance-chart__plot finance-chart__plot--recharts">
              <div
                className="finance-chart__plot-inner"
                style={{ width: `${Math.max(chartData.length * 140, 100)}px` }}
              >
                <ResponsiveContainer width="100%" height={380}>
                  <ComposedChart data={chartData} margin={{ top: 12, right: 20, left: 8, bottom: 8 }}>
                  <CartesianGrid stroke="#b3c4da" strokeDasharray="4 4" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: '#52627a', fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    interval={0}
                    minTickGap={24}
                  />
                  <YAxis
                    tick={{ fill: '#52627a', fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    width={92}
                    tickFormatter={(value) => formatCurrency(value)}
                  />
                  <Tooltip content={renderChartTooltip} cursor={{ fill: 'rgba(59, 130, 246, 0.06)' }} />
                  <Bar dataKey="ingresos" name="Ingresos" fill="#10b981" radius={[10, 10, 0, 0]} barSize={24} />
                  <Bar dataKey="egresos" name="Egresos" fill="#ef4444" radius={[10, 10, 0, 0]} barSize={24} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="finance-history-card">
        <div className="finance-history-card__header">
          <h2>Historial de Movimientos</h2>
        </div>

        <div className="finance-history-filters">
          <h3>Filtros de búsqueda</h3>

          <div className="filters-row filters-row--date" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: '1 1 0', minWidth: '140px' }}>
              <label htmlFor="desde-input" style={{ fontWeight: 700, fontSize: '0.85rem' }}>Desde</label>
              <input
                id="desde-input"
                type="date"
                className="search-input finance-date-input"
                value={desde}
                onChange={(event) => setDesde(event.target.value)}
                placeholder="Desde"
              />
            </div>
            <span style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center', paddingTop: '1.15rem' }}>—</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: '1 1 0', minWidth: '140px' }}>
              <label htmlFor="hasta-input" style={{ fontWeight: 700, fontSize: '0.85rem' }}>Hasta</label>
              <input
                id="hasta-input"
                type="date"
                className="search-input finance-date-input"
                value={hasta}
                onChange={(event) => setHasta(event.target.value)}
                placeholder="Hasta"
              />
            </div>
            <div style={{ position: 'relative', marginLeft: '0.5rem', flex: '0 0 auto', paddingTop: '1.6rem' }}>
              <label style={{ position: 'absolute', top: 0, left: 0, fontWeight: 700, fontSize: '0.85rem' }}>Método de pago</label>
              <div className="finance-method-selector sede-selector" ref={metodoSelectorRef}>
                <div className="finance-method-selector__control">
                  <button
                    type="button"
                    className="finance-method-selector__trigger"
                    aria-haspopup="listbox"
                    aria-expanded={isMetodoMenuOpen}
                    onClick={() => setIsMetodoMenuOpen((open) => !open)}
                  >
                    <span className="finance-method-selector__trigger-text">{activeMetodoLabel}</span>
                  </button>
                  <svg className="finance-method-selector__chevron" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {isMetodoMenuOpen ? (
                    <div className="sede-selector__menu finance-method-selector__menu" role="listbox" aria-label="Selector de método de pago">
                      {METODO_PAGO_OPTIONS.map((option) => {
                        const isSelected = option.value === metodoFilter;

                        return (
                          <button
                            key={option.value}
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            className={isSelected ? 'sede-selector__item sede-selector__item--active' : 'sede-selector__item'}
                            onClick={() => handleMetodoFilterChange(option.value)}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', paddingTop: '1.40rem', marginLeft: '0.5rem', gap: '0.25rem', flex: '0 0 auto' }}>
              <Button variant="secondary" onClick={() => { setDesde(''); setHasta(''); }}>Limpiar</Button>
            </div>
          </div>

          <div className="filters-row filters-row--search" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.75rem' }}>
            <div className="search-container search-container--finance search-container--compact" style={{ flex: 1 }}>
              <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <input
                type="text"
                className="search-input"
                placeholder="Buscar movimiento..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>

            
          </div>

          
        </div>

        <div className="table-container finance-history-table-wrap">
          {isLoading ? (
            <div className="skeleton-table">
              {[...Array(6)].map((_, index) => (
                <div key={index} className="skeleton-row skeleton-row--finance">
                  <div className="skeleton-cell" style={{ width: '12%' }} />
                  <div className="skeleton-cell" style={{ width: '8%' }} />
                  <div className="skeleton-cell" style={{ width: '18%' }} />
                  <div className="skeleton-cell" style={{ width: '12%' }} />
                  <div className="skeleton-cell" style={{ width: '10%' }} />
                  <div className="skeleton-cell" style={{ width: '20%' }} />
                  <div className="skeleton-cell" style={{ width: '12%' }} />
                </div>
              ))}
            </div>
          ) : filteredMovimientos.length === 0 ? (
            <div className="empty-state finance-empty-state">
              <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🧾</div>
              <h3>No hay movimientos para mostrar</h3>
              <p>Prueba cambiando los filtros o revisa los registros almacenados en la BDD.</p>
            </div>
          ) : (
            <>
              <table className="finance-history-table">
                <thead>
                  <tr>
                    <th>Doctor</th>
                    <th>Tipo</th>
                    <th>Método de pago</th>
                    <th>Monto</th>
                    <th>Descripción</th>
                    <th>Fecha Registro</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedMovimientos.map((movimiento) => (
                    <tr key={movimiento.id} className={getMovementClass(movimiento.tipo)}>
                      <td>{getDoctorLabel(movimiento)}</td>
                      <td>
                        <span className={`finance-type-badge ${getTypeBadgeClass(movimiento.tipo)}`}>
                          {movimiento.tipo || 'sin tipo'}
                        </span>
                      </td>
                      <td>{movimiento.metodo_pago || '-'}</td>
                      <td className={movimiento.tipo === 'egreso' ? 'finance-amount finance-amount--expense' : 'finance-amount finance-amount--income'}>
                        {formatSignedCurrency(movimiento.tipo, movimiento.monto)}
                      </td>
                      <td className="finance-description">{movimiento.descripcion || '-'}</td>
                      <td>{formatDate(movimiento.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="finance-history-mobile-list" aria-label="Historial de movimientos en móvil">
                {paginatedMovimientos.map((movimiento) => {
                  const isExpanded = expandedMovimientoId === movimiento.id;
                  const amountLabel = formatSignedCurrency(movimiento.tipo, movimiento.monto);

                  return (
                    <article key={movimiento.id} className={`finance-history-mobile-card ${getMovementClass(movimiento.tipo)}`}>
                      <div className="finance-history-mobile-card__summary">
                        <button
                          type="button"
                          className="finance-history-mobile-card__summary-toggle"
                          onClick={() => toggleMovimientoDetails(movimiento.id)}
                          aria-expanded={isExpanded}
                          aria-controls={`movimiento-mobile-details-${movimiento.id}`}
                        >
                          <span className="finance-history-mobile-card__toggle" aria-hidden="true">
                            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                          </span>
                        </button>

                        <button
                          type="button"
                          className="finance-history-mobile-card__summary-main"
                          onClick={() => toggleMovimientoDetails(movimiento.id)}
                          aria-expanded={isExpanded}
                          aria-controls={`movimiento-mobile-details-${movimiento.id}`}
                        >
                          <span className="finance-history-mobile-card__amount-label">Monto</span>
                          <span className={movimiento.tipo === 'egreso' ? 'finance-history-mobile-card__amount finance-history-mobile-card__amount--expense' : 'finance-history-mobile-card__amount finance-history-mobile-card__amount--income'}>
                            <strong>{amountLabel}</strong>
                          </span>
                        </button>

                        <span className="finance-history-mobile-card__summary-actions">
                          <button
                            type="button"
                            onClick={() => openMovimientoDetail(movimiento)}
                            className="action-btn action-btn--view"
                            title="Ver detalles"
                          >
                            <Eye size={16} />
                          </button>
                        </span>
                      </div>

                      {isExpanded ? (
                        <div className="finance-history-mobile-card__details" id={`movimiento-mobile-details-${movimiento.id}`}>
                          <div className="finance-history-mobile-card__row">
                            <span className="finance-history-mobile-card__label">Tipo</span>
                            <span className="finance-history-mobile-card__value">
                              <span className={`finance-type-badge ${getTypeBadgeClass(movimiento.tipo)}`}>
                                {movimiento.tipo || 'sin tipo'}
                              </span>
                            </span>
                          </div>
                          {renderMovimientoDetails(movimiento).map((item) => (
                            <div key={item.label} className="finance-history-mobile-card__row">
                              <span className="finance-history-mobile-card__label">{item.label}</span>
                              <span className="finance-history-mobile-card__value">{item.value}</span>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>

              <div className="finance-pagination">
                <div className="finance-pagination__info">
                  Mostrando {Math.min(filteredMovimientos.length, (currentPage - 1) * MOVIMIENTOS_POR_PAGINA + 1)}-
                  {Math.min(filteredMovimientos.length, currentPage * MOVIMIENTOS_POR_PAGINA)} de {filteredMovimientos.length}
                </div>
                <div className="finance-pagination__controls">
                  <Button
                    variant="secondary"
                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                    disabled={currentPage <= 1}
                  >
                    Anterior
                  </Button>
                  <span className="finance-pagination__page">Página {currentPage} de {totalPages}</span>
                  <Button
                    variant="secondary"
                    onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                    disabled={currentPage >= totalPages}
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      {isDetailOpen && selectedMovimiento ? (
        <div className="modal-overlay" onClick={closeMovimientoDetail}>
          <div className="modal-content modal-content--finance-detail" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2>Detalle del Movimiento</h2>
              <button type="button" className="modal-close" onClick={closeMovimientoDetail}>✕</button>
            </div>
            <div className="finance-form finance-form--readonly finance-form--detail-view">
              {renderMovimientoDetails(selectedMovimiento).map((item) => (
                <div key={item.label} className="finance-read-row">
                  <div className="finance-read-label">{item.label}</div>
                  <div className="finance-read-value">{item.value}</div>
                </div>
              ))}
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary btn-detail-close" onClick={closeMovimientoDetail}>
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
