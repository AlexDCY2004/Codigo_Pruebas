import { useMemo, useState } from 'react';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createMovimientoFinanzas,
  deleteMovimientoFinanzas,
  fetchEgresos,
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

export default function EgresosPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEgreso, setSelectedEgreso] = useState(null);
  const [isViewMode, setIsViewMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [formData, setFormData] = useState(initialFormState);
  const [formErrors, setFormErrors] = useState({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmError, setConfirmError] = useState('');

  const { data: egresos = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['egresos'],
    queryFn: () => fetchEgresos()
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

      const matchesDate = !dateFilter || egreso.fecha === dateFilter;
      return matchesSearch && matchesDate;
    });
  }, [dateFilter, egresos, searchTerm]);

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
      fecha: toInputDate(egreso.fecha)
    });
    setFormErrors({});
    setErrorMessage('');
    setIsModalOpen(true);
  };

  const handleDeleteEgreso = (egreso) => {
    setPendingDelete(egreso);
    setConfirmError('');
    setConfirmOpen(true);
  };

  const confirmDeleteEgreso = async () => {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      await deleteMovimientoFinanzas(pendingDelete.id);
      queryClient.invalidateQueries({ queryKey: ['egresos'] });
      setConfirmOpen(false);
      setPendingDelete(null);
    } catch (error) {
      const raw = error.response?.data?.error || error.message || '';
      let friendly = 'No se pudo eliminar el egreso.';
      if (String(raw).toLowerCase().includes('foreign key') || String(raw).toLowerCase().includes('violates')) {
        friendly = 'No se puede eliminar el egreso porque está en uso.';
      }
      setConfirmError(friendly);
      setErrorMessage(friendly);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleViewEgreso = (egreso) => {
    setSelectedEgreso(egreso);
    setIsViewMode(true);
    setFormData({
      id_doctor: egreso.id_doctor || '',
      monto: egreso.monto !== undefined && egreso.monto !== null ? String(egreso.monto) : '',
      descripcion: egreso.descripcion || '',
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
      tipo: 'egreso',
      id_doctor: formData.id_doctor ? Number(formData.id_doctor) : null,
      monto: Number(formData.monto),
      descripcion: formData.descripcion.trim() || null,
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
          <h3>Filtrar por fecha</h3>
          <input
            type="date"
            className="search-input finance-date-input"
            value={dateFilter}
            onChange={(event) => setDateFilter(event.target.value)}
          />
        </section>

        <section className="finance-total-card finance-total-card--expense">
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
                  <td className="finance-amount finance-amount--expense">{formatCurrency(egreso.monto)}</td>
                  <td className="finance-description">{egreso.descripcion || '-'}</td>
                  <td>{formatDate(egreso.created_at)}</td>
                  <td className="table-actions">
                    <button type="button" onClick={() => handleViewEgreso(egreso)} className="action-btn action-btn--view" title="Ver detalles">👁</button>
                    <button type="button" onClick={() => openEditModal(egreso)} className="action-btn action-btn--edit" title="Editar">✎</button>
                    <button type="button" onClick={() => handleDeleteEgreso(egreso)} className="action-btn action-btn--delete" title="Eliminar">🗑</button>
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
                  <ReadRow label="Monto:" value={formatCurrency(selectedEgreso?.monto)} />
                  <ReadRow label="Descripción:" value={selectedEgreso?.descripcion || '-'} />
                  <ReadRow label="Fecha Registro:" value={formatDate(selectedEgreso?.created_at)} />

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
                        placeholder="Descripción del egreso"
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
              title="Eliminar Egreso"
              message={confirmError || `¿Eliminar el egreso de ${formatCurrency(pendingDelete?.monto || 0)}?`}
              onConfirm={confirmDeleteEgreso}
              onCancel={() => { setConfirmOpen(false); setPendingDelete(null); setConfirmError(''); }}
              isLoading={isDeleting}
            />
    </div>
  );
}
