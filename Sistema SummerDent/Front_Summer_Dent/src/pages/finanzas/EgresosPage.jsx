import { useMemo, useState } from 'react';
import { Eye, Edit2 } from 'lucide-react';
import ConfirmModal from '../../components/ui/ConfirmModal';
import Button from '../../components/ui/Button';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createMovimientoFinanzas,
  fetchEgresos,
  updateMovimientoFinanzas
} from '../../services/api/movimientoFinanzas';
import { fetchDoctores } from '../../services/api/doctores';
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
  let cleaned = s.replace(/[^0-9.]/g, '');
  if (!cleaned) return '';
  const firstDot = cleaned.indexOf('.');
  if (firstDot !== -1) {
    cleaned = cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '');
  }
  const parts = cleaned.split('.');
  let intPart = parts[0] || '';
  let decPart = parts[1] || '';
  intPart = intPart.slice(0, 5);
  decPart = decPart.slice(0, 2);
  if (cleaned.endsWith('.') && decPart === '') {
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

export default function EgresosPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [metodoPago, setMetodoPago] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEgreso, setSelectedEgreso] = useState(null);
  const [isViewMode, setIsViewMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [formData, setFormData] = useState(initialFormState);
  const [formErrors, setFormErrors] = useState({});
  const { data: egresos = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['egresos', desde, hasta, metodoPago],
    queryFn: () => fetchEgresos({ desde: desde || undefined, hasta: hasta || undefined, metodo_pago: metodoPago || undefined })
  });

  const { data: doctores = [], isLoading: isDoctoresLoading } = useQuery({
    queryKey: ['doctores'],
    queryFn: fetchDoctores
  });

  const totalEgresos = useMemo(
    () => egresos.reduce((acc, egreso) => acc + Number(egreso.monto || 0), 0),
    [egresos]
  );

  const filteredEgresos = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return egresos.filter((egreso) => {
      const matchesSearch = !search || [
        formatDate(egreso.fecha),
        formatDate(egreso.created_at),
        String(egreso.id_doctor || '').toLowerCase(),
        String(egreso.tipo || '').toLowerCase(),
        String(egreso.monto || '').toLowerCase(),
        String(egreso.descripcion || '').toLowerCase(),
        getDoctorLabel(egreso).toLowerCase()
      ].some((field) => field.includes(search));
      const fechaKey = egreso.fecha ? String(egreso.fecha).slice(0, 10) : '';
      let matchesDate = true;
      if (desde && hasta) matchesDate = fechaKey >= desde && fechaKey <= hasta;
      else if (desde) matchesDate = fechaKey >= desde;
      else if (hasta) matchesDate = fechaKey <= hasta;

      let matchesMetodo = true;
      if (metodoPago) matchesMetodo = String(egreso.metodo_pago || '').toLowerCase() === String(metodoPago).toLowerCase();

      return matchesSearch && matchesDate && matchesMetodo;
    });
  }, [desde, hasta, egresos, searchTerm, metodoPago]);

  const openCreateModal = () => {
    setSelectedEgreso(null);
    setIsViewMode(false);
    setFormData(initialFormState);
    setFormErrors({});
    setErrorMessage('');
    setIsModalOpen(true);
  };

  const openEditModal = (egreso) => {
    setSelectedEgreso(egreso);
    setIsViewMode(false);
    setFormData({
      id_doctor: egreso.id_doctor || '',
      monto: egreso.monto !== undefined && egreso.monto !== null ? String(egreso.monto) : '',
      descripcion: egreso.descripcion || '',
      metodo_pago: egreso.metodo_pago || '',
      fecha: toInputDate(egreso.fecha)
    });
    setFormErrors({});
    setErrorMessage('');
    setIsModalOpen(true);
  };

  const handleViewEgreso = (egreso) => {
    setSelectedEgreso(egreso);
    setIsViewMode(true);
    setFormData({
      id_doctor: egreso.id_doctor || '',
      monto: egreso.monto !== undefined && egreso.monto !== null ? String(egreso.monto) : '',
      descripcion: egreso.descripcion || '',
      metodo_pago: egreso.metodo_pago || '',
      fecha: toInputDate(egreso.fecha)
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

    // For new egresos, require the fecha to be today's date
    if (!selectedEgreso) {
      const today = getTodayInputDate();
      if (!formData.fecha || formData.fecha !== today) {
        nextErrors.fecha = 'Para un nuevo egreso la fecha debe ser la fecha actual';
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
    if (!validateForm()) return;

    setIsSaving(true);
    setErrorMessage('');

    const payload = {
      tipo: 'egreso',
      id_doctor: formData.id_doctor ? Number(formData.id_doctor) : null,
      monto: Number(formData.monto),
      descripcion: formData.descripcion.trim() || null,
      metodo_pago: formData.metodo_pago ? String(formData.metodo_pago) : undefined,
      fecha: formData.fecha || undefined
    };

    try {
      if (selectedEgreso?.id) {
        await updateMovimientoFinanzas(selectedEgreso.id, payload);
      } else {
        await createMovimientoFinanzas(payload);
      }

      setIsModalOpen(false);
      setSelectedEgreso(null);
      setFormData(initialFormState);
      queryClient.invalidateQueries({ queryKey: ['egresos'] });
    } catch (error) {
      setErrorMessage(error.response?.data?.error || 'No se pudo guardar el egreso.');
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
          <h1>Gestión de Egresos</h1>
          <p>Registra los egresos del consultorio</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreateModal}>
          + Nuevo Egreso
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
              <select value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)} className="">
                <option value="">Todos</option>
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
                <option value="tarjeta">Tarjeta</option>
              </select>
            </div>
          </div>
        </section>

        <section className="finance-total-card finance-total-card--expense" style={{ flex: '0 0 30%' }}>
          <span>Total de Egresos</span>
          <strong>{formatCurrency(totalEgresos)}</strong>
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
          placeholder="Buscar por fecha, doctor, monto, descripción o perfil..."
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
        ) : filteredEgresos.length === 0 ? (
          <div className="empty-state">
            <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>💸</div>
            <h3>No hay egresos registrados</h3>
            <p>Prueba ajustando el filtro de fecha o agrega un nuevo egreso.</p>
          </div>
        ) : (
          <table className="ingresos-table egresos-table">
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
              {filteredEgresos.map((egreso) => (
                <tr key={egreso.id}>
                  <td>{getDoctorLabel(egreso)}</td>
                  <td>{egreso.metodo_pago || '-'}</td>
                  <td className="finance-amount finance-amount--expense">{formatCurrency(egreso.monto)}</td>
                  <td className="finance-description">{egreso.descripcion || '-'}</td>
                  <td>{formatDate(egreso.fecha)}</td>
                  <td className="table-actions">
                    <button type="button" onClick={() => handleViewEgreso(egreso)} className="action-btn action-btn--view" title="Ver detalles"><Eye size={16} /></button>
                    <button type="button" onClick={() => openEditModal(egreso)} className="action-btn action-btn--edit" title="Editar"><Edit2 size={16} /></button>
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
              <h2>{isViewMode ? 'Ver Egreso' : selectedEgreso?.id ? 'Editar Egreso' : 'Nuevo Egreso'}</h2>
              <button type="button" className="modal-close" onClick={() => {
                setIsModalOpen(false);
                setIsViewMode(false);
              }}>✕</button>
            </div>

            <form className={`finance-form ${isViewMode ? 'finance-form--readonly' : ''}`} onSubmit={handleSubmit}>
              {isViewMode ? (
                <>
                  <ReadRow label="Fecha:" value={formatDate(selectedEgreso?.fecha)} />
                  <ReadRow label="Doctor:" value={getDoctorLabel(selectedEgreso || {})} />
                  <ReadRow label="Tipo:" value={selectedEgreso?.tipo || 'egreso'} />
                  <ReadRow label="Método:" value={selectedEgreso?.metodo_pago || '-'} />
                  <ReadRow label="Monto:" value={formatCurrency(selectedEgreso?.monto)} />
                  <ReadRow label="Descripción:" value={selectedEgreso?.descripcion || '-'} />
                  <ReadRow label="Fecha Registro:" value={formatDate(selectedEgreso?.created_at)} />

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
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="id_doctor">Doctor</label>
                      <select
                        id="id_doctor"
                        name="id_doctor"
                        value={formData.id_doctor}
                        onChange={handleFormChange}
                        disabled={isDoctoresLoading}
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
                        className={formErrors.descripcion ? 'input-error' : ''}
                        placeholder="Descripción del egreso"
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
                    <button type="submit" className="btn btn-primary btn-modal-save" disabled={isSaving}>
                      {isSaving ? 'Guardando...' : 'Guardar'}
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
