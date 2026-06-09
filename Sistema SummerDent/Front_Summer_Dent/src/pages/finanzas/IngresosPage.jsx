import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Eye, Edit2 } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import ConfirmModal from '../../components/ui/ConfirmModal';
import Button from '../../components/ui/Button';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createMovimientoFinanzas,
  fetchIngresos,
  updateMovimientoFinanzas
} from '../../services/api/movimientoFinanzas';
import { fetchDoctores } from '../../services/api/doctores';
import { fetchCitas } from '../../services/api/citas';
import ErrorState from '../../components/feedback/ErrorState';

const getTodayInputDate = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

const initialFormState = {
  id_doctor: '',
  monto: '',
  descripcion: '',
  metodo_pago: 'efectivo',
  fecha: getTodayInputDate()
};

const MOVIMIENTOS_POR_PAGINA = 15;

const METODO_PAGO_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'deposito', label: 'Depósito' },
  { value: 'tarjeta', label: 'Tarjeta' }
];

const formatCurrency = (value) => new Intl.NumberFormat('es-EC', {
  style: 'currency',
  currency: 'USD'
}).format(Number(value ?? 0));

const formatDate = (value) => {
  if (!value) return '-';

  // For DATEONLY values (YYYY-MM-DD), avoid timezone conversion that can shift one day.
  const raw = String(value).split('T')[0];
  const parts = raw.split('-');
  if (parts.length === 3) {
    const y = Number(parts[0]);
    const m = Number(parts[1]) - 1;
    const d = Number(parts[2]);
    const date = new Date(y, m, d);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString('es-EC', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
    }
  }

  const fallback = new Date(value);
  if (Number.isNaN(fallback.getTime())) return '-';
  return fallback.toLocaleDateString('es-EC', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
};

const toInputDate = (value) => {
  if (!value) return '';
  // Keep DATEONLY value intact without UTC conversion.
  const raw = String(value).split('T')[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const sanitizeMontoInput = (raw) => {
  const s = String(raw || '');
  // keep only digits and dots
  let cleaned = s.replace(/[^0-9.]/g, '');
  if (!cleaned) return '';
  // keep only first dot
  const firstDot = cleaned.indexOf('.');
  if (firstDot !== -1) {
    cleaned = cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '');
  }

  const parts = cleaned.split('.');
  let intPart = parts[0] || '';
  let decPart = parts[1] || '';

  // limit integer part to 5 digits and decimals to 2
  intPart = intPart.slice(0, 5);
  decPart = decPart.slice(0, 2);

  // if user typed a trailing dot, preserve it while typing
  if (cleaned.endsWith('.') && decPart === '') {
    // allow '.5' style by converting empty int to '0.'
    if (intPart === '') return '0.';
    return `${intPart}.`;
  }

  if (decPart) return `${intPart}.${decPart}`;
  return intPart;
};

const ReadRow = ({ label, value }) => (
  <div className="finance-read-row">
    <div className="finance-read-label">{label}</div>
    <div className="finance-read-value">{value || '-'}</div>
  </div>
);

const getDoctorLabel = (movimiento) => {
  if (movimiento.doctor?.nombre) {
    return movimiento.doctor.nombre;
  }

  return movimiento.id_doctor ? `Doctor #${movimiento.id_doctor}` : '-';
};

const sameMoney = (a, b) => Math.abs(Number(a || 0) - Number(b || 0)) < 0.001;

const isIngresoDesdeCitaAtendida = (ingreso, citas = []) => {
  if (!ingreso || String(ingreso.tipo || '').toLowerCase() !== 'ingreso') return false;

  const descripcion = String(ingreso.descripcion || '').toLowerCase();
  if (descripcion.includes('cita')) return true;

  const ingresoDoctor = ingreso.id_doctor !== undefined && ingreso.id_doctor !== null
    ? Number(ingreso.id_doctor)
    : null;
  const ingresoFecha = ingreso.fecha ? String(ingreso.fecha).slice(0, 10) : '';

  return (citas || []).some((cita) => {
    const estado = String(cita.estado || '').toLowerCase();
    if (estado !== 'atendida') return false;

    const citaDoctor = cita.id_doctor !== undefined && cita.id_doctor !== null
      ? Number(cita.id_doctor)
      : null;
    const citaFecha = cita.fecha ? String(cita.fecha).slice(0, 10) : '';

    return citaDoctor === ingresoDoctor
      && sameMoney(cita.precio, ingreso.monto)
      && citaFecha === ingresoFecha;
  });
};

export default function IngresosPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const [searchTerm, setSearchTerm] = useState('');
  //const [dateFilter, setDateFilter] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [dateError, setDateError] = useState('');
  const [metodoPago, setMetodoPago] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedIngreso, setSelectedIngreso] = useState(null);
  const [isViewMode, setIsViewMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [formData, setFormData] = useState(initialFormState);
  const [formErrors, setFormErrors] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [isMetodoMenuOpen, setIsMetodoMenuOpen] = useState(false);
  const metodoSelectorRef = useRef(null);
  const sedeActiva = useAuthStore((s) => s.sedeActiva);

  const { data: ingresos = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['ingresos', sedeActiva, desde, hasta, metodoPago],
    queryFn: () => fetchIngresos({ desde: desde || undefined, hasta: hasta || undefined, metodo_pago: metodoPago || undefined, sede_id: sedeActiva || undefined })
  });

  const { data: doctores = [], isLoading: isDoctoresLoading } = useQuery({
    queryKey: ['doctores'],
    queryFn: fetchDoctores
  });

  const { data: citas = [] } = useQuery({
    queryKey: ['citas'],
    queryFn: fetchCitas
  });

  const isIngresoBloqueado = Boolean(
    !isViewMode
    && selectedIngreso?.id
    && isIngresoDesdeCitaAtendida(selectedIngreso, citas)
  );

  const isSuperadmin = user && user.rol === 'superadmin';
  const [expandedIngresoId, setExpandedIngresoId] = useState(null);

  const toggleIngresoDetails = (ingresoId) => {
    setExpandedIngresoId((currentId) => (currentId === ingresoId ? null : ingresoId));
  };

  const renderIngresoActions = (ingreso) => (
    <div className="table-actions table-actions--mobile">
      <button
        type="button"
        onClick={() => handleViewIngreso(ingreso)}
        className="action-btn action-btn--view"
        title="Ver detalles"
      >
        <Eye size={16} />
      </button>
      {!isSuperadmin && (
        <button
          type="button"
          onClick={() => openEditModal(ingreso)}
          className="action-btn action-btn--edit"
          title="Editar"
        >
          <Edit2 size={16} />
        </button>
      )}
    </div>
  );

  const renderIngresoDetails = (ingreso) => [
    { label: 'Doctor', value: getDoctorLabel(ingreso) },
    { label: 'Monto', value: formatCurrency(ingreso.monto) },
    { label: 'Descripción', value: ingreso.descripcion || '-' },
    { label: 'Fecha Registro', value: formatDate(ingreso.fecha) }
  ];

  const totalIngresos = useMemo(
    () => ingresos.reduce((acc, ingreso) => acc + Number(ingreso.monto || 0), 0),
    [ingresos]
  );

  const filteredIngresos = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return ingresos.filter((ingreso) => {
      const matchesSearch = !search || [
        formatDate(ingreso.fecha),
        formatDate(ingreso.created_at),
        String(ingreso.id_doctor || '').toLowerCase(),
        String(ingreso.tipo || '').toLowerCase(),
        String(ingreso.monto || '').toLowerCase(),
        String(ingreso.descripcion || '').toLowerCase(),
        getDoctorLabel(ingreso).toLowerCase()
      ].some((field) => field.includes(search));
      // Apply local range filtering as a safety net (server already filters when params provided)
      const fechaKey = ingreso.fecha ? String(ingreso.fecha).slice(0, 10) : '';
      let matchesDate = true;
      if (desde && hasta) matchesDate = fechaKey >= desde && fechaKey <= hasta;
      else if (desde) matchesDate = fechaKey >= desde;
      else if (hasta) matchesDate = fechaKey <= hasta;

      // metodo_pago filter (server handles it when provided, but keep local fallback)
      let matchesMetodo = true;
      if (metodoPago) matchesMetodo = String(ingreso.metodo_pago || '').toLowerCase() === String(metodoPago).toLowerCase();

      return matchesSearch && matchesDate && matchesMetodo;
    });
  }, [desde, hasta, ingresos, searchTerm, metodoPago]);

  const totalPages = Math.max(1, Math.ceil(filteredIngresos.length / MOVIMIENTOS_POR_PAGINA));

  const paginatedIngresos = useMemo(() => {
    const startIndex = (currentPage - 1) * MOVIMIENTOS_POR_PAGINA;
    return filteredIngresos.slice(startIndex, startIndex + MOVIMIENTOS_POR_PAGINA);
  }, [currentPage, filteredIngresos]);

  useEffect(() => {
    setCurrentPage(1);
  }, [desde, hasta, searchTerm, metodoPago]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

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

  const activeMetodoLabel = METODO_PAGO_OPTIONS.find((option) => option.value === metodoPago)?.label || 'Todos';

  const handleMetodoChange = (value) => {
    setMetodoPago(value);
    setIsMetodoMenuOpen(false);
  };

  const openCreateModal = () => {
    setSelectedIngreso(null);
    setIsViewMode(false);
    setFormData(initialFormState);
    setFormErrors({});
    setErrorMessage('');
    setIsModalOpen(true);
  };

  const openEditModal = (ingreso) => {
    setSelectedIngreso(ingreso);
    setIsViewMode(false);
    setFormData({
      id_doctor: ingreso.id_doctor || '',
      monto: ingreso.monto !== undefined && ingreso.monto !== null ? String(ingreso.monto) : '',
      descripcion: ingreso.descripcion || '',
      metodo_pago: ingreso.metodo_pago || '',
      fecha: toInputDate(ingreso.fecha)
    });
    setFormErrors({});
    setErrorMessage('');
    setIsModalOpen(true);
  };

  const handleViewIngreso = (ingreso) => {
    setSelectedIngreso(ingreso);
    setIsViewMode(true);
    setFormData({
      id_doctor: ingreso.id_doctor || '',
      monto: ingreso.monto !== undefined && ingreso.monto !== null ? String(ingreso.monto) : '',
      descripcion: ingreso.descripcion || '',
      metodo_pago: ingreso.metodo_pago || '',
      fecha: toInputDate(ingreso.fecha)
    });
    setFormErrors({});
    setErrorMessage('');
    setIsModalOpen(true);
  };

  const validateForm = () => {
    const nextErrors = {};

    if (!formData.monto.trim()) {
      nextErrors.monto = 'El monto es obligatorio';
    } else if (!/^\d{1,5}(\.\d{1,2})?$/.test(formData.monto.trim())) {
      nextErrors.monto = 'El monto debe tener hasta 5 dígitos enteros y hasta 2 decimales';
    } else if (Number(formData.monto) <= 0) {
      nextErrors.monto = 'El monto debe ser mayor a 0';
    } else if (Number(formData.monto) > 99999.99) {
      nextErrors.monto = 'El monto no puede ser mayor a 99999.99';
    }

    if (formData.descripcion && formData.descripcion.length > 300) {
      nextErrors.descripcion = 'La descripción no puede superar 300 caracteres';
    }

    if (formData.fecha && !/^\d{4}-\d{2}-\d{2}$/.test(formData.fecha)) {
      nextErrors.fecha = 'La fecha debe tener formato YYYY-MM-DD';
    }

    // For new ingresos (not editing an existing one), require the date to be today's date
    if (!selectedIngreso) {
      const today = getTodayInputDate();
      if (!formData.fecha || formData.fecha !== today) {
        nextErrors.fecha = 'La fecha debe ser la fecha actual';
      }
    }

    setFormErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;

    let nextValue = value;
    if (name === 'monto') nextValue = sanitizeMontoInput(value);

    setFormData((prev) => ({
      ...prev,
      [name]: nextValue
    }));

    if (formErrors[name]) {
      setFormErrors((prev) => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handlePaste = (event) => {
    const { name } = event.target;
    if (name === 'monto') {
      event.preventDefault();
      const paste = (event.clipboardData || window.clipboardData).getData('text') || '';
      const sanitized = sanitizeMontoInput(paste);
      setFormData((prev) => ({ ...prev, monto: sanitized }));
      if (formErrors.monto) setFormErrors((prev) => ({ ...prev, monto: '' }));
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isIngresoBloqueado) return;
    if (!validateForm()) return;

    setIsSaving(true);
    setErrorMessage('');

    const payload = {
      tipo: 'ingreso',
      id_doctor: formData.id_doctor ? Number(formData.id_doctor) : null,
      monto: Number(formData.monto),
      descripcion: formData.descripcion.trim() || null,
      metodo_pago: formData.metodo_pago ? String(formData.metodo_pago) : undefined,
      fecha: formData.fecha || undefined
    };

    if (sedeActiva) payload.sede_id = sedeActiva;

    try {
      if (selectedIngreso?.id) {
        await updateMovimientoFinanzas(selectedIngreso.id, payload);
      } else {
        await createMovimientoFinanzas(payload);
      }

      setIsModalOpen(false);
      setSelectedIngreso(null);
      setFormData(initialFormState);
      queryClient.invalidateQueries({ queryKey: ['ingresos', sedeActiva] });
      // actualizar cache de caja mensual para que refleje los movimientos recientes
      queryClient.invalidateQueries({ queryKey: ['caja-mensual', sedeActiva] });
      queryClient.invalidateQueries({ queryKey: ['caja-mensual-history', sedeActiva] });
      queryClient.invalidateQueries({ queryKey: ['caja-mensual-dashboard', sedeActiva] });
    } catch (error) {
      setErrorMessage(error.response?.data?.error || 'No se pudo guardar el ingreso.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isError) {
    return <ErrorState onRetry={refetch} />;
  }

  return (
    <div className="page-container">
      <div className="page-header page-header--finance">
        <div>
          <h1>Gestión de Ingresos</h1>
          <p>Registra los ingresos del consultorio</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreateModal}>
          + Nuevo Ingreso
        </button>
      </div>

      <div className="finance-summary-grid">
        <section className="finance-filter-card">
          <h3>Filtrar por rango</h3>
          <div className="finance-range-row">
            <div className="finance-range-field">
              <label style={{ fontSize: '0.85rem', marginBottom: '0.25rem', fontWeight: 700 }}>Desde</label>
              <input
                type="date"
                className="search-input finance-date-input"
                value={desde}
                onChange={(event) => {
                  const v = event.target.value;
                  setDesde(v);
                  // if invalid range, show error
                  if (v && hasta && v > hasta) setDateError('La fecha desde cuando se quiere filtrar debe ser menor o igual que hasta cuando se quiere filtrar');
                  else setDateError('');
                }}
                placeholder="Desde"
              />
            </div>

            <div className="finance-range-field">
              <label style={{ fontSize: '0.85rem', marginBottom: '0.25rem', fontWeight: 700 }}>Hasta</label>
              <input
                type="date"
                className="search-input finance-date-input"
                value={hasta}
                onChange={(event) => {
                  const v = event.target.value;
                  setHasta(v);
                  // if invalid range, show error
                  if (v && desde && v < desde) setDateError('La fecha "Hasta" debe ser mayor o igual que "Desde"');
                  else setDateError('');
                }}
                placeholder="Hasta"
              />
            </div>

            <Button variant="secondary" onClick={() => { setDesde(''); setHasta(''); }} className="finance-range-actions">Limpiar</Button>
          </div>
          {dateError && (
            <div className="alert alert-error" style={{ marginTop: '0.5rem' }}>{dateError}</div>
          )}

          <div style={{ marginTop: '0.75rem' }}>
            <h3 style={{ margin: 0, fontSize: '0.85rem' }}>Método de pago</h3>
            <div style={{ marginTop: '0.5rem' }}>
              <div className="finance-method-selector sede-selector" ref={metodoSelectorRef} style={{ width: '100%', flex: '1 1 auto' }}>
                <div className="finance-method-selector__control" style={{ width: '100%' }}>
                  <button
                    type="button"
                    className="finance-method-selector__trigger"
                    aria-haspopup="listbox"
                    aria-expanded={isMetodoMenuOpen}
                    onClick={() => setIsMetodoMenuOpen((open) => !open)}
                  >
                    <span className="finance-method-selector__trigger-text">{activeMetodoLabel}</span>
                  </button>
                  <ChevronDown className="finance-method-selector__chevron" size={18} aria-hidden="true" />
                  {isMetodoMenuOpen ? (
                    <div className="finance-method-selector__menu" role="listbox" aria-label="Selector de método de pago">
                      {METODO_PAGO_OPTIONS.map((option) => {
                        const isSelected = option.value === metodoPago;

                        return (
                          <button
                            key={option.value || 'todos'}
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            className={isSelected ? 'sede-selector__item sede-selector__item--active' : 'sede-selector__item'}
                            onClick={() => handleMetodoChange(option.value)}
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
          </div>
        </section>

        <section className="finance-total-card finance-total-card--income" style={{ flex: '0 0 30%' }}>
          <span>Total de Ingresos</span>
          <strong>{formatCurrency(totalIngresos)}</strong>
        </section>
      </div>

      <div className="search-container search-container--finance">
        <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          type="text"
          className="search-input"
          placeholder="Buscar por fecha, doctor, monto o descripción..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />
      </div>

      {errorMessage && (
        <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
          {errorMessage}
        </div>
      )}

      <div className="table-container">
        {isLoading ? (
          <div className="skeleton-table">
            {[...Array(4)].map((_, index) => (
              <div key={index} className="skeleton-row">
                <div className="skeleton-cell" style={{ width: '12%' }} />
                <div className="skeleton-cell" style={{ width: '16%' }} />
                <div className="skeleton-cell" style={{ width: '20%' }} />
                <div className="skeleton-cell" style={{ width: '10%' }} />
                <div className="skeleton-cell" style={{ width: '22%' }} />
                <div className="skeleton-cell" style={{ width: '10%' }} />
                <div className="skeleton-cell" style={{ width: '10%' }} />
              </div>
            ))}
          </div>
        ) : filteredIngresos.length === 0 ? (
          <div className="empty-state">
            <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>💰</div>
            <h3>No hay ingresos registrados</h3>
            <p>Prueba ajustando el filtro de fecha o agrega un nuevo ingreso.</p>
          </div>
        ) : (
          <>
            <table className="ingresos-table">
              <thead>
                <tr>
                  <th>Doctor</th>
                  <th>Método de pago</th>
                  <th>Monto</th>
                  <th>Descripción</th>
                  <th>Fecha Registro</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {paginatedIngresos.map((ingreso) => (
                  <tr key={ingreso.id}>
                    <td>{getDoctorLabel(ingreso)}</td>
                    <td>{ingreso.metodo_pago || '-'}</td>
                    <td className="finance-amount">{formatCurrency(ingreso.monto)}</td>
                    <td className="finance-description">{ingreso.descripcion || '-'}</td>
                    <td>{formatDate(ingreso.fecha)}</td>
                    <td className="table-actions">
                      {(() => {
                        const user = useAuthStore.getState().user;
                        const isSuperadmin = user && user.rol === 'superadmin';
                        return (
                          <>
                            <button type="button" onClick={() => handleViewIngreso(ingreso)} className="action-btn action-btn--view" title="Ver detalles"><Eye size={16} /></button>
                            {!isSuperadmin && (
                              <button type="button" onClick={() => openEditModal(ingreso)} className="action-btn action-btn--edit" title="Editar"><Edit2 size={16} /></button>
                            )}
                          </>
                        );
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="ingresos-mobile-list" aria-label="Tabla de ingresos en móvil">
              {paginatedIngresos.map((ingreso) => {
                const isExpanded = expandedIngresoId === ingreso.id;

                return (
                  <article key={ingreso.id} className="ingresos-mobile-card">
                    <button
                      type="button"
                      className="ingresos-mobile-card__summary"
                      onClick={() => toggleIngresoDetails(ingreso.id)}
                      aria-expanded={isExpanded}
                      aria-controls={`ingreso-mobile-details-${ingreso.id}`}
                    >
                      <span className="ingresos-mobile-card__toggle" aria-hidden="true">
                        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </span>

                      <span className="ingresos-mobile-card__summary-main">
                        <span className="ingresos-mobile-card__method-label">Monto</span>
                        <span className="ingresos-mobile-card__method-value">
                          <strong>{formatCurrency(ingreso.monto)}</strong>
                        </span>
                      </span>

                      <span className="ingresos-mobile-card__summary-actions" onClick={(event) => event.stopPropagation()}>
                        {renderIngresoActions(ingreso)}
                      </span>
                    </button>

                    {isExpanded ? (
                      <div className="ingresos-mobile-card__details" id={`ingreso-mobile-details-${ingreso.id}`}>
                        {renderIngresoDetails(ingreso).map((item) => (
                          <div key={item.label} className="ingresos-mobile-card__row">
                            <span className="ingresos-mobile-card__label">{item.label}</span>
                            <span className="ingresos-mobile-card__value">{item.value}</span>
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
                Mostrando {Math.min(filteredIngresos.length, (currentPage - 1) * MOVIMIENTOS_POR_PAGINA + 1)}-
                {Math.min(filteredIngresos.length, currentPage * MOVIMIENTOS_POR_PAGINA)} de {filteredIngresos.length}
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

      {isModalOpen && (
        <div className="modal-overlay" onClick={() => {
          setIsModalOpen(false);
          setIsViewMode(false);
        }}>
          <div className="modal-content" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2>{isViewMode ? 'Ver Ingreso' : selectedIngreso?.id ? 'Editar Ingreso' : 'Nuevo Ingreso'}</h2>
              <button type="button" className="modal-close" onClick={() => {
                setIsModalOpen(false);
                setIsViewMode(false);
              }}>✕</button>
            </div>

            <form className={`finance-form ${isViewMode ? 'finance-form--readonly' : ''}`} onSubmit={handleSubmit}>
              {isViewMode ? (
                <>
                  <ReadRow label="Fecha:" value={formatDate(selectedIngreso?.fecha)} />
                  <ReadRow label="Doctor:" value={getDoctorLabel(selectedIngreso || {})} />
                  <ReadRow label="Tipo:" value={selectedIngreso?.tipo || 'ingreso'} />
                      <ReadRow label="Método:" value={selectedIngreso?.metodo_pago || '-'} />
                  <ReadRow label="Monto:" value={formatCurrency(selectedIngreso?.monto)} />
                  <ReadRow label="Descripción:" value={selectedIngreso?.descripcion || '-'} />
                  <ReadRow label="Fecha Registro:" value={formatDate(selectedIngreso?.created_at)} />

                  <div className="modal-footer">
                    <button type="button" className="btn btn-secondary btn-detail-close" onClick={() => {
                      setIsModalOpen(false);
                      setIsViewMode(false);
                    }}>
                      Cerrar
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {isIngresoBloqueado && (
                    <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
                      Este ingreso proviene de una cita atendida. Debe editarse desde el módulo de Citas.
                    </div>
                  )}
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="id_doctor">Doctor</label>
                      <select
                        id="id_doctor"
                        name="id_doctor"
                        value={formData.id_doctor}
                        onChange={handleFormChange}
                        disabled={isDoctoresLoading || isIngresoBloqueado}
                      >
                        <option value="">No especificado</option>

                        {doctores.map((doc) => (
                          <option key={doc.id} value={String(doc.id)}>{doc.nombre}</option>
                        ))}
                      </select>
                      {isDoctoresLoading && <div className="hint">Cargando doctores...</div>}
                    </div>
                    <div className="form-group">
                      <label htmlFor="fecha">Fecha</label>
                      <input
                        id="fecha"
                        name="fecha"
                        type="date"
                        value={formData.fecha}
                        onChange={handleFormChange}
                        disabled={isIngresoBloqueado}
                        className={formErrors.fecha ? 'input-error' : ''}
                      />
                      {formErrors.fecha && <span className="error-text">{formErrors.fecha}</span>}
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="monto">Monto *</label>
                      <input
                        id="monto"
                        name="monto"
                        type="text"
                        inputMode="decimal"
                        value={formData.monto}
                        onChange={handleFormChange}
                        onPaste={handlePaste}
                        disabled={isIngresoBloqueado}
                        className={formErrors.monto ? 'input-error' : ''}
                        placeholder="0.00"
                      />
                      {formErrors.monto && <span className="error-text">{formErrors.monto}</span>}
                    </div>
                    <div className="form-group">
                      <label htmlFor="descripcion">Descripción</label>
                      <input
                        id="descripcion"
                        name="descripcion"
                        type="text"
                        value={formData.descripcion}
                        onChange={handleFormChange}
                        disabled={isIngresoBloqueado}
                        className={formErrors.descripcion ? 'input-error' : ''}
                        placeholder="Descripción del ingreso"
                      />
                      {formErrors.descripcion && <span className="error-text">{formErrors.descripcion}</span>}
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="metodo_pago">Método de pago</label>
                      <select
                        id="metodo_pago"
                        name="metodo_pago"
                        value={formData.metodo_pago}
                        onChange={handleFormChange}
                        disabled={isIngresoBloqueado}
                        className={formErrors.metodo_pago ? 'input-error' : ''}
                      >
                        
                        <option value="efectivo">Efectivo</option>
                        <option value="transferencia">Transferencia</option>
                        <option value="tarjeta">Tarjeta</option>
                      </select>
                    </div>
                  </div>

                  <div className="modal-footer">
                    <button type="button" className="btn btn-secondary btn-modal-cancel" onClick={() => setIsModalOpen(false)}>
                      Cancelar
                    </button>
                    <button type="submit" className="btn btn-primary btn-modal-save" disabled={isSaving || isIngresoBloqueado}>
                      {isIngresoBloqueado ? 'Bloqueado' : (isSaving ? 'Guardando...' : 'Guardar')}
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
