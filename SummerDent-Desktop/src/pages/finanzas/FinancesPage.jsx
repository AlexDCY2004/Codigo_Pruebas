import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Eye } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { fetchMovimientosFinanzas } from '../../services/movimientoFinanzas';
import ErrorState from '../../components/feedback/ErrorState';

const MOVIMIENTOS_POR_PAGINA = 15;

const METODO_PAGO_OPTIONS = [
  { value: 'todos', label: 'Todos métodos' },
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'tarjeta', label: 'Tarjeta' }
];

const formatCurrency = (value) => new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(Number(value ?? 0));

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('es-EC', { year: 'numeric', month: '2-digit', day: '2-digit' });
};

const getDoctorLabel = (movimiento) => movimiento.doctor?.nombre || '-';

export default function FinancesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
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
    const s = searchTerm.trim().toLowerCase();
    return movimientos.filter((m) => {
      const matchesMetodo = metodoFilter === 'todos' || m.metodo_pago === metodoFilter;
      const fechaKey = String(m.fecha || '');
      let matchesDate = true;
      if (desde && hasta) matchesDate = fechaKey >= desde && fechaKey <= hasta;
      else if (desde) matchesDate = fechaKey >= desde;
      else if (hasta) matchesDate = fechaKey <= hasta;
      const searchable = [fechaKey, m.id_doctor, m.monto, m.descripcion, getDoctorLabel(m)].filter(Boolean).map((f) => String(f).toLowerCase());
      const matchesSearch = !s || searchable.some((f) => f.includes(s));
      return matchesDate && matchesSearch && matchesMetodo;
    });
  }, [desde, hasta, movimientos, searchTerm, metodoFilter]);

  const totalMovimientos = useMemo(() => filteredMovimientos.reduce((a, m) => a + Number(m.monto || 0), 0), [filteredMovimientos]);
  const movimientosCount = filteredMovimientos.length;
  const efectivoTotal = useMemo(() => filteredMovimientos.filter((m) => m.metodo_pago === 'efectivo').reduce((a, m) => a + Number(m.monto || 0), 0), [filteredMovimientos]);
  const transferenciaTotal = useMemo(() => filteredMovimientos.filter((m) => m.metodo_pago === 'transferencia').reduce((a, m) => a + Number(m.monto || 0), 0), [filteredMovimientos]);

  const totalPages = Math.max(1, Math.ceil(filteredMovimientos.length / MOVIMIENTOS_POR_PAGINA));
  const paginatedMovimientos = useMemo(() => {
    const start = (currentPage - 1) * MOVIMIENTOS_POR_PAGINA;
    return filteredMovimientos.slice(start, start + MOVIMIENTOS_POR_PAGINA);
  }, [currentPage, filteredMovimientos]);

  const toggleMovimientoDetails = (id) => setExpandedMovimientoId((curr) => curr === id ? null : id);
  const openMovimientoDetail = (m) => { setSelectedMovimiento(m); setIsDetailOpen(true); };
  const closeMovimientoDetail = () => { setIsDetailOpen(false); setSelectedMovimiento(null); };

  const renderMovimientoDetails = (movimiento) => [
    { label: 'Doctor', value: getDoctorLabel(movimiento) },
    { label: 'Método de pago', value: movimiento.metodo_pago || '-' },
    { label: 'Monto', value: formatCurrency(movimiento.monto) },
    { label: 'Descripción', value: movimiento.descripcion || '-' },
    { label: 'Fecha Registro', value: formatDate(movimiento.created_at) }
  ];

  useEffect(() => { setCurrentPage(1); }, [desde, hasta, searchTerm, metodoFilter]);
  useEffect(() => {
    const handlePointerDown = (e) => { if (!metodoSelectorRef.current?.contains(e.target)) setIsMetodoMenuOpen(false); };
    const handleEscape = (e) => { if (e.key === 'Escape') setIsMetodoMenuOpen(false); };
    document.addEventListener('mousedown', handlePointerDown); document.addEventListener('touchstart', handlePointerDown); document.addEventListener('keydown', handleEscape);
    return () => { document.removeEventListener('mousedown', handlePointerDown); document.removeEventListener('touchstart', handlePointerDown); document.removeEventListener('keydown', handleEscape); };
  }, []);

  const activeMetodoLabel = METODO_PAGO_OPTIONS.find((o) => o.value === metodoFilter)?.label || 'Todos métodos';
  const handleMetodoFilterChange = (value) => { setMetodoFilter(value); setIsMetodoMenuOpen(false); };

  if (isError) return <ErrorState onRetry={refetch} />;

  return (
    <div className="page-container finance-page">
      <div className="page-header page-header--finance">
        <div><h1>Módulo Financiero</h1><p>Análisis y resumen financiero del consultorio</p></div>
      </div>
      <div className="finance-summary-grid">
        <section className="finance-total-card"><span>Total Ingresos</span><strong>{formatCurrency(totalMovimientos)}</strong></section>
        <section className="finance-total-card finance-total-card--count"><span>Cantidad de Movimientos</span><strong>{movimientosCount}</strong></section>
        <section className="finance-total-card finance-total-card--cash"><span>Efectivo</span><strong>{formatCurrency(efectivoTotal)}</strong></section>
        <section className="finance-total-card finance-total-card--transfer"><span>Transferencia</span><strong>{formatCurrency(transferenciaTotal)}</strong></section>
      </div>
      <section className="finance-history-card">
        <div className="finance-history-card__header"><h2>Historial de Movimientos</h2></div>
        <div className="finance-history-filters">
          <h3>Filtros de búsqueda</h3>
          <div className="filters-row filters-row--date" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: '1 1 0', minWidth: '140px' }}>
              <label style={{ fontWeight: 700, fontSize: '0.85rem' }}>Desde</label>
              <input type="date" className="search-input finance-date-input" value={desde} onChange={(e) => setDesde(e.target.value)} />
            </div>
            <span style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center', paddingTop: '1.15rem' }}>—</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: '1 1 0', minWidth: '140px' }}>
              <label style={{ fontWeight: 700, fontSize: '0.85rem' }}>Hasta</label>
              <input type="date" className="search-input finance-date-input" value={hasta} onChange={(e) => setHasta(e.target.value)} />
            </div>
            <div style={{ position: 'relative', marginLeft: '0.5rem', flex: '0 0 auto', paddingTop: '1.6rem' }}>
              <div className="finance-method-selector sede-selector" ref={metodoSelectorRef}>
                <div className="finance-method-selector__control">
                  <button type="button" className="finance-method-selector__trigger" aria-haspopup="listbox" aria-expanded={isMetodoMenuOpen} onClick={() => setIsMetodoMenuOpen((o) => !o)}>
                    <span className="finance-method-selector__trigger-text">{activeMetodoLabel}</span>
                  </button>
                  <svg className="finance-method-selector__chevron" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {isMetodoMenuOpen && (
                    <div className="sede-selector__menu finance-method-selector__menu" role="listbox">
                      {METODO_PAGO_OPTIONS.map((option) => (
                        <button key={option.value} type="button" role="option" aria-selected={option.value === metodoFilter}
                          className={option.value === metodoFilter ? 'sede-selector__item sede-selector__item--active' : 'sede-selector__item'}
                          onClick={() => handleMetodoFilterChange(option.value)}>{option.label}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div style={{ paddingTop: '1.40rem', marginLeft: '0.5rem' }}>
              <button className="btn btn-secondary" onClick={() => { setDesde(''); setHasta(''); }}>Limpiar</button>
            </div>
          </div>
          <div className="filters-row filters-row--search" style={{ marginTop: '0.75rem' }}>
            <div className="search-container search-container--finance search-container--compact" style={{ flex: 1 }}>
              <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
              <input type="text" className="search-input" placeholder="Buscar movimiento..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="table-container finance-history-table-wrap">
          {isLoading ? (
            <div className="skeleton-table">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="skeleton-row skeleton-row--finance">
                  <div className="skeleton-cell" style={{ width: '12%' }} /><div className="skeleton-cell" style={{ width: '18%' }} />
                  <div className="skeleton-cell" style={{ width: '12%' }} /><div className="skeleton-cell" style={{ width: '10%' }} />
                  <div className="skeleton-cell" style={{ width: '20%' }} /><div className="skeleton-cell" style={{ width: '12%' }} />
                </div>
              ))}
            </div>
          ) : filteredMovimientos.length === 0 ? (
            <div className="empty-state finance-empty-state">
              <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🧾</div>
              <h3>No hay movimientos para mostrar</h3>
              <p>Prueba cambiando los filtros o revisa los registros almacenados.</p>
            </div>
          ) : (
            <>
              <table className="finance-history-table">
                <thead><tr><th>Doctor</th><th>Método de pago</th><th>Monto</th><th>Descripción</th><th>Fecha Registro</th></tr></thead>
                <tbody>
                  {paginatedMovimientos.map((m) => (
                    <tr key={m.id}>
                      <td>{getDoctorLabel(m)}</td><td>{m.metodo_pago || '-'}</td>
                      <td>{formatCurrency(m.monto)}</td><td className="finance-description">{m.descripcion || '-'}</td>
                      <td>{formatDate(m.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="finance-history-mobile-list">
                {paginatedMovimientos.map((m) => {
                  const isExpanded = expandedMovimientoId === m.id;
                  return (
                    <article key={m.id} className="finance-history-mobile-card">
                      <div className="finance-history-mobile-card__summary">
                        <button type="button" className="finance-history-mobile-card__summary-toggle" onClick={() => toggleMovimientoDetails(m.id)} aria-expanded={isExpanded}>
                          <span aria-hidden="true">{isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</span>
                        </button>
                        <button type="button" className="finance-history-mobile-card__summary-main" onClick={() => toggleMovimientoDetails(m.id)} aria-expanded={isExpanded}>
                          <span className="finance-history-mobile-card__amount-label">Monto</span>
                          <span className="finance-history-mobile-card__amount"><strong>{formatCurrency(m.monto)}</strong></span>
                        </button>
                        <span className="finance-history-mobile-card__summary-actions">
                          <button type="button" onClick={() => openMovimientoDetail(m)} className="action-btn action-btn--view" title="Ver detalles"><Eye size={16} /></button>
                        </span>
                      </div>
                      {isExpanded && (
                        <div className="finance-history-mobile-card__details">
                          {renderMovimientoDetails(m).map((item) => (
                            <div key={item.label} className="finance-history-mobile-card__row">
                              <span className="finance-history-mobile-card__label">{item.label}</span>
                              <span className="finance-history-mobile-card__value">{item.value}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </section>
      {!isLoading && filteredMovimientos.length > 0 && (
        <div className="finance-pagination">
          <div className="finance-pagination__info">Mostrando {Math.min(filteredMovimientos.length, (currentPage - 1) * MOVIMIENTOS_POR_PAGINA + 1)}-{Math.min(filteredMovimientos.length, currentPage * MOVIMIENTOS_POR_PAGINA)} de {filteredMovimientos.length}</div>
          <div className="finance-pagination__controls">
            <button className="btn btn-secondary" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage <= 1}>Anterior</button>
            <span className="finance-pagination__page">Página {currentPage} de {totalPages}</span>
            <button className="btn btn-secondary" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}>Siguiente</button>
          </div>
        </div>
      )}
      {isDetailOpen && selectedMovimiento && (
        <div className="modal-overlay" onClick={closeMovimientoDetail}>
          <div className="modal-content modal-content--finance-detail" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><h2>Detalle del Movimiento</h2><button type="button" className="modal-close" onClick={closeMovimientoDetail}>✕</button></div>
            <div className="finance-detail-body">
              {renderMovimientoDetails(selectedMovimiento).map((item) => (
                <div key={item.label} className="finance-detail-row"><span className="finance-detail-label">{item.label}</span><span className="finance-detail-value">{item.value}</span></div>
              ))}
            </div>
            <div className="modal-footer"><button type="button" onClick={closeMovimientoDetail} className="btn btn-secondary">Cerrar</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
