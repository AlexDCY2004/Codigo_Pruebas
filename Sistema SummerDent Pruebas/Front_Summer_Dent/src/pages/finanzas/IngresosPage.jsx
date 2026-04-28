import { useMemo, useState } from 'react';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createMovimientoFinanzas,
  deleteMovimientoFinanzas,
  fetchIngresos,
  updateMovimientoFinanzas
} from '../../services/api/movimientoFinanzas';
import { fetchDoctores } from '../../services/api/doctores';
import ErrorState from '../../components/feedback/ErrorState';

const initialFormState = {
  id_doctor: '',
  monto: '',
  descripcion: '',
  fecha: ''
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

const toInputDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
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

export default function IngresosPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
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
    queryKey: ['ingresos'],
    queryFn: () => fetchIngresos()
  });

  const { data: doctores = [], isLoading: isDoctoresLoading } = useQuery({
    queryKey: ['doctores'],
    queryFn: fetchDoctores
  });

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

      const matchesDate = !dateFilter || ingreso.fecha === dateFilter;
      return matchesSearch && matchesDate;
    });
  }, [dateFilter, ingresos, searchTerm]);

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

    setFormData((prev) => ({
      ...prev,
      [name]: value
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
    if (!validateForm()) return;

    setIsSaving(true);
    setErrorMessage('');

    const payload = {
      tipo: 'ingreso',
      id_doctor: formData.id_doctor ? Number(formData.id_doctor) : null,
      monto: Number(formData.monto),
      descripcion: formData.descripcion.trim() || null,
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
          <h3>Filtrar por fecha</h3>
          <input
            type="date"
            className="search-input finance-date-input"
            value={dateFilter}
            onChange={(event) => setDateFilter(event.target.value)}
          />
        </section>

        <section className="finance-total-card finance-total-card--income">
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
          <table className="ingresos-table">
            <thead>
              <tr>
                <th>Doctor</th>
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
                  <td className="finance-amount">{formatCurrency(ingreso.monto)}</td>
                  <td className="finance-description">{ingreso.descripcion || '-'}</td>
                  <td>{formatDate(ingreso.created_at)}</td>
                  <td className="table-actions">
                    <button type="button" onClick={() => handleViewIngreso(ingreso)} className="action-btn action-btn--view" title="Ver detalles">👁</button>
                    <button type="button" onClick={() => openEditModal(ingreso)} className="action-btn action-btn--edit" title="Editar">✎</button>
                    <button type="button" onClick={() => handleDeleteIngreso(ingreso)} className="action-btn action-btn--delete" title="Eliminar">🗑</button>
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
                  <ReadRow label="Monto:" value={formatCurrency(selectedIngreso?.monto)} />
                  <ReadRow label="Descripción:" value={selectedIngreso?.descripcion || '-'} />
                  <ReadRow label="Fecha Registro:" value={formatDate(selectedIngreso?.created_at)} />

                  <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={() => {
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
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.monto}
                        onChange={handleFormChange}
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
                        placeholder="Descripción del ingreso"
                      />
                      {formErrors.descripcion && <span className="error-text">{formErrors.descripcion}</span>}
                    </div>
                  </div>

                  <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                      Cancelar
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={isSaving}>
                      {isSaving ? 'Guardando...' : 'Guardar'}
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
