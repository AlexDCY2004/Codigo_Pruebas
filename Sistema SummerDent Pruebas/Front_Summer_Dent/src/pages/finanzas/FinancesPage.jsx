import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchMovimientosFinanzas } from '../../services/api/movimientoFinanzas';
import ErrorState from '../../components/feedback/ErrorState';

const PERIODS = {
  diario: 'diario',
  semanal: 'semanal',
  mensual: 'mensual'
};

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

const safeDateKey = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

const getDoctorLabel = (movimiento) => {
  if (movimiento.doctor?.nombre) {
    return movimiento.doctor.nombre;
  }

  return '-';
};

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
    return `${start.toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit' })} - ${end.toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit' })}`;
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
    return start.toISOString().slice(0, 10);
  }

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

export default function FinancesPage() {
  const [period, setPeriod] = useState(PERIODS.mensual);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('todos');

  const { data: movimientos = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['movimientos-financieros'],
    queryFn: () => fetchMovimientosFinanzas()
  });

  const filteredMovimientos = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return movimientos.filter((movimiento) => {
      const matchesType = typeFilter === 'todos' || movimiento.tipo === typeFilter;
      const matchesDate = !dateFilter || safeDateKey(movimiento.fecha) === dateFilter;

      const searchableFields = [
        safeDateKey(movimiento.fecha),
        safeDateKey(movimiento.created_at),
        movimiento.id_doctor,
        movimiento.tipo,
        movimiento.monto,
        movimiento.descripcion,
        getDoctorLabel(movimiento)
      ]
        .filter(Boolean)
        .map((field) => String(field).toLowerCase());

      const matchesSearch = !normalizedSearch || searchableFields.some((field) => field.includes(normalizedSearch));

      return matchesType && matchesDate && matchesSearch;
    });
  }, [dateFilter, movimientos, searchTerm, typeFilter]);

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
      const keyDate = safeDateKey(movimiento.fecha);
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

    return Array.from(buckets.values()).map((bucket) => ({
      ...bucket,
      balance: bucket.ingresos - bucket.egresos
    }));
  }, [filteredMovimientos, period]);

  const chartMax = useMemo(() => {
    const values = chartData.flatMap((bucket) => [bucket.ingresos, bucket.egresos, Math.abs(bucket.balance)]);
    return Math.max(1, ...values);
  }, [chartData]);

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
          <h2>Gráfico Financiero</h2>
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
            <div className="finance-chart__axis finance-chart__axis--y">
              <span>{formatCurrency(chartMax)}</span>
              <span>{formatCurrency(chartMax / 2)}</span>
              <span>$0</span>
              <span>{formatCurrency(chartMax / 2 * -1)}</span>
              <span>{formatCurrency(chartMax * -1)}</span>
            </div>

            <div className="finance-chart__plot">
              {chartData.map((bucket) => {
                const ingresoHeight = Math.max(6, (bucket.ingresos / chartMax) * 100);
                const egresoHeight = Math.max(6, (bucket.egresos / chartMax) * 100);
                const balanceHeight = Math.max(6, (Math.abs(bucket.balance) / chartMax) * 100);

                return (
                  <div key={`${bucket.label}-${bucket.ingresos}-${bucket.egresos}`} className="finance-chart__group">
                    <div className="finance-chart__bars">
                      <div className="chart-bar chart-bar--income" style={{ height: `${ingresoHeight}%` }} title={`Ingresos: ${formatCurrency(bucket.ingresos)}`} />
                      <div className="chart-bar chart-bar--expense" style={{ height: `${egresoHeight}%` }} title={`Egresos: ${formatCurrency(bucket.egresos)}`} />
                      <div className={bucket.balance >= 0 ? 'chart-bar chart-bar--balance-positive' : 'chart-bar chart-bar--balance-negative'} style={{ height: `${balanceHeight}%` }} title={`Balance: ${formatCurrency(bucket.balance)}`} />
                    </div>
                    <div className="finance-chart__label">{bucket.label}</div>
                  </div>
                );
              })}
            </div>

            <div className="finance-chart__legend">
              <span><i className="legend-dot legend-dot--income" />Ingresos</span>
              <span><i className="legend-dot legend-dot--expense" />Egresos</span>
              <span><i className="legend-dot legend-dot--balance" />Balance</span>
            </div>
          </div>
        )}
      </section>

      <section className="finance-history-card">
        <div className="finance-history-card__header">
          <h2>Historial de Movimientos</h2>
          <div className="finance-filters">
            <div className="search-container search-container--finance search-container--compact">
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

            <input
              type="date"
              className="search-input finance-date-input"
              value={dateFilter}
              onChange={(event) => setDateFilter(event.target.value)}
            />

            <select
              className="search-input finance-type-select"
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
            >
              <option value="todos">Todos</option>
              <option value="ingreso">Ingresos</option>
              <option value="egreso">Egresos</option>
            </select>
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
            <table className="finance-history-table">
              <thead>
                <tr>
                  <th>Doctor</th>
                  <th>Tipo</th>
                  <th>Monto</th>
                  <th>Descripción</th>
                  <th>Fecha Registro</th>
                </tr>
              </thead>
              <tbody>
                {filteredMovimientos.map((movimiento) => (
                  <tr key={movimiento.id} className={getMovementClass(movimiento.tipo)}>
                    <td>{getDoctorLabel(movimiento)}</td>
                    <td>
                      <span className={`finance-type-badge ${getTypeBadgeClass(movimiento.tipo)}`}>
                        {movimiento.tipo || 'sin tipo'}
                      </span>
                    </td>
                    <td className={movimiento.tipo === 'egreso' ? 'finance-amount finance-amount--expense' : 'finance-amount finance-amount--income'}>
                      {formatSignedCurrency(movimiento.tipo, movimiento.monto)}
                    </td>
                    <td className="finance-description">{movimiento.descripcion || '-'}</td>
                    <td>{formatDate(movimiento.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
