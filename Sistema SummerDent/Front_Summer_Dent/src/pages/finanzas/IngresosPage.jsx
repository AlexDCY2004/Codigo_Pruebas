import { useMemo, useState } from 'react';
import { Eye, Edit2, Trash2 } from 'lucide-react';
import ConfirmModal from '../../components/ui/ConfirmModal';
import Button from '../../components/ui/Button';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createMovimientoFinanzas,
  deleteMovimientoFinanzas,
  fetchIngresos,
  updateMovimientoFinanzas
} from '../../services/api/movimientoFinanzas';
import { fetchDoctores } from '../../services/api/doctores';
import { fetchCitas } from '../../services/api/citas';
import ErrorState from '../../components/feedback/ErrorState';
import { sanitizeText, sanitizeDecimal } from '../../utils/sanitize';

const initialFormState = {
  id_doctor: '',
  monto: '',
  descripcion: '',
  metodo_pago: '',
  fecha: ''
};

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
  const [searchTerm, setSearchTerm] = useState('');
  //const [dateFilter, setDateFilter] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [metodoPago, setMetodoPago] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedIngreso, setSelectedIngreso] = useState(null);
  const [isViewMode, setIsViewMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [formData, setFormData] = useState(initialFormState);
  const [formErrors, setFormErrors] = useState({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmError, setConfirmError] = useState('');

  const { data: ingresos = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['ingresos', desde, hasta, metodoPago],
    queryFn: () => fetchIngresos({ desde: desde || undefined, hasta: hasta || undefined, metodo_pago: metodoPago || undefined })
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

  const handleDeleteIngreso = (ingreso) => {
    setPendingDelete(ingreso);
    setConfirmError('');
    setConfirmOpen(true);
  };

  const confirmDeleteIngreso = async () => {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      await deleteMovimientoFinanzas(pendingDelete.id);
      queryClient.invalidateQueries({ queryKey: ['ingresos'] });
      setConfirmOpen(false);
      setPendingDelete(null);
    } catch (error) {
      const raw = error.response?.data?.error || error.message || '';
      let friendly = 'No se pudo eliminar el ingreso.';
      if (String(raw).toLowerCase().includes('foreign key') || String(raw).toLowerCase().includes('violates')) {
        friendly = 'No se puede eliminar el ingreso porque está en uso.';
      }
      setConfirmError(friendly);
      setErrorMessage(friendly);
    } finally {
      setIsDeleting(false);
    }
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
    } else if (!/^\d+(\.\d{1,2})?$/.test(formData.monto.trim())) {
      nextErrors.monto = 'El monto debe ser un número válido';
    } else if (Number(formData.monto) <= 0) {
      nextErrors.monto = 'El monto debe ser mayor a 0';
    }

    if (formData.descripcion && formData.descripcion.length > 300) {
      nextErrors.descripcion = 'La descripción no puede superar 300 caracteres';
    }

    if (formData.fecha && !/^\d{4}-\d{2}-\d{2}$/.test(formData.fecha)) {
      nextErrors.fecha = 'La fecha debe tener formato YYYY-MM-DD';
    }

    setFormErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;

    let sanitized = value;
    switch (name) {
      case 'monto':
        sanitized = sanitizeDecimal(value);
        break;
      case 'descripcion':
        sanitized = sanitizeText(value, 300);
        break;
      default:
        break;
    }

    setFormData((prev) => ({
      ...prev,
      [name]: sanitized
    }));

    if (formErrors[name]) {
      setFormErrors((prev) => ({
        ...prev,
        [name]: ''
      }));
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

    try {
      if (selectedIngreso?.id) {
        await updateMovimientoFinanzas(selectedIngreso.id, payload);
      } else {
        await createMovimientoFinanzas(payload);
      }

      setIsModalOpen(false);
      setSelectedIngreso(null);
      setFormData(initialFormState);
      queryClient.invalidateQueries({ queryKey: ['ingresos'] });
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
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              type="date"
              className="search-input finance-date-input"
              value={desde}
              onChange={(event) => setDesde(event.target.value)}
              placeholder="Desde"
            />
            <span style={{ fontSize: '0.9rem' }}>—</span>
            <input
              type="date"
              className="search-input finance-date-input"
              value={hasta}
              onChange={(event) => setHasta(event.target.value)}
              placeholder="Hasta"
            />
            <Button variant="secondary" onClick={() => { setDesde(''); setHasta(''); }} style={{ marginLeft: '0.5rem' }}>Limpiar</Button>
          </div>

          <div style={{ marginTop: '0.75rem' }}>
            <h3 style={{ margin: 0, fontSize: '1rem' }}>Método de pago</h3>
            <div style={{ marginTop: '0.5rem' }}>
              <select value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)}>
                <option value="">Todos</option>
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
                <option value="tarjeta">Tarjeta</option>
              </select>
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
          onChange={(event) => setSearchTerm(sanitizeText(event.target.value, 100))}
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
              {filteredIngresos.map((ingreso) => (
                <tr key={ingreso.id}>
                  <td>{getDoctorLabel(ingreso)}</td>
                  <td>{ingreso.metodo_pago || '-'}</td>
                  <td className="finance-amount">{formatCurrency(ingreso.monto)}</td>
                  <td className="finance-description">{ingreso.descripcion || '-'}</td>
                  <td>{formatDate(ingreso.fecha)}</td>
                  <td className="table-actions">
                    <button type="button" onClick={() => handleViewIngreso(ingreso)} className="action-btn action-btn--view" title="Ver detalles"><Eye size={16} /></button>
                    <button type="button" onClick={() => openEditModal(ingreso)} className="action-btn action-btn--edit" title="Editar"><Edit2 size={16} /></button>
                    <button type="button" onClick={() => handleDeleteIngreso(ingreso)} className="action-btn action-btn--delete" title="Eliminar"><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.monto}
                        onChange={handleFormChange}
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

      <ConfirmModal
        isOpen={confirmOpen}
        title="Eliminar Ingreso"
        message={confirmError || `¿Eliminar el ingreso de ${formatCurrency(pendingDelete?.monto || 0)}?`}
        onConfirm={confirmDeleteIngreso}
        onCancel={() => { setConfirmOpen(false); setPendingDelete(null); setConfirmError(''); }}
        isLoading={isDeleting}
      />
    </div>
  );
}
