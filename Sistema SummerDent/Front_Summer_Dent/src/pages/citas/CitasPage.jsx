import { useMemo, useState } from 'react';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchCitas, createCita, updateCita, deleteCita } from '../../services/api/citas';
import { fetchPacientes } from '../../services/api/pacientes';
import { fetchDoctores } from '../../services/api/doctores';
import { fetchTratamientos } from '../../services/api/tratamientos';
import CitasTable from '../../components/citas/CitasTable';
import CitaModal from '../../components/citas/CitaModal';
import LoadingState from '../../components/feedback/LoadingState';

const getPacienteNombre = (cita, pacientes) => {
  if (cita.paciente?.nombre) {
    return `${cita.paciente.nombre} ${cita.paciente.apellido}`.trim();
  }

  const paciente = pacientes.find((item) => String(item.id_cedula) === String(cita.id_paciente));
  return paciente ? `${paciente.nombre} ${paciente.apellido}`.trim() : '-';
};

export default function CitasPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCita, setSelectedCita] = useState(null);
  const [modalMode, setModalMode] = useState('create'); // 'create' | 'edit' | 'view'
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [serverFormErrors, setServerFormErrors] = useState({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmError, setConfirmError] = useState('');

  const { data: citas = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['citas'],
    queryFn: fetchCitas
  });

  const { data: pacientes = [] } = useQuery({
    queryKey: ['pacientes'],
    queryFn: fetchPacientes
  });

  const { data: doctores = [] } = useQuery({
    queryKey: ['doctores'],
    queryFn: fetchDoctores
  });

  const { data: tratamientos = [] } = useQuery({
    queryKey: ['tratamientos'],
    queryFn: fetchTratamientos
  });

  const filteredCitas = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    const dateOnly = dateFilter;

    return citas.filter((cita) => {
      // Filter by date if date filter is set
      if (dateOnly) {
        const citaDate = String(cita.fecha || '').split('T')[0];
        if (citaDate !== dateOnly) return false;
      }

      // If there's no search term, include the (possibly date-filtered) cita
      if (!search) return true;

      const pacienteNombre = getPacienteNombre(cita, pacientes).toLowerCase();

      const doctorNombre = cita.doctor?.nombre
        ? cita.doctor.nombre.toLowerCase()
        : (doctores.find((item) => String(item.id) === String(cita.id_doctor))?.nombre || '').toLowerCase();

      const estado = (cita.estado || '').toLowerCase();

      return (
        pacienteNombre.includes(search)
        || doctorNombre.includes(search)
        || estado.includes(search)
      );
    });
  }, [citas, doctores, pacientes, searchTerm, dateFilter]);

  const handleNewCita = () => {
    setSelectedCita(null);
    setModalMode('create');
    setServerFormErrors({});
    setError(null);
    setIsModalOpen(true);
  };

  const handleEditCita = (cita) => {
    setSelectedCita(cita);
    setModalMode('edit');
    setServerFormErrors({});
    setError(null);
    setIsModalOpen(true);
  };

  const handleDeleteCita = (cita) => {
    setPendingDelete(cita);
    setConfirmError('');
    setConfirmOpen(true);
  };

  const confirmDeleteCita = async () => {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      await deleteCita(pendingDelete.id);
      queryClient.invalidateQueries({ queryKey: ['citas'] });
      setConfirmOpen(false);
      setPendingDelete(null);
    } catch (err) {
      const raw = err?.response?.data?.error || err?.message || '';
      let friendly = 'Error al eliminar la cita';
      if (String(raw).toLowerCase().includes('foreign key') || String(raw).toLowerCase().includes('violates')) {
        friendly = 'No se puede eliminar la cita porque está en uso.';
      }
      setConfirmError(friendly);
      setError(friendly);
      console.error(err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleViewCita = (cita) => {
    setSelectedCita(cita);
    setModalMode('view');
    setError(null);
    setIsModalOpen(true);
  };

  const handleSubmitModal = async (formData) => {
    setIsSaving(true);
    setError(null);
    setServerFormErrors({});
    try {
      if (selectedCita?.id) {
        await updateCita(selectedCita.id, formData);
      } else {
        await createCita(formData);
      }
      setIsModalOpen(false);
      setSelectedCita(null);
      queryClient.invalidateQueries({ queryKey: ['citas'] });
    } catch (err) {
      const serverError = err?.response?.data?.error || err?.response?.data?.mensaje || err?.response?.data?.message || err.message;
      // If backend sent a string message, show it inside the modal form; otherwise fallback to top error
      if (typeof serverError === 'string' && serverError.trim()) {
        setServerFormErrors({ _form: serverError });
        setError(null);
      } else {
        setServerFormErrors({});
        setError(serverError || 'Error al guardar la cita');
      }
      console.error('Error al guardar cita:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Gestión de Citas</h1>
          <p>Administra las citas del consultorio</p>
        </div>
        <button className="btn btn-primary" onClick={handleNewCita}>
          + Nueva Cita
        </button>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      <div
        className="search-container search-container--compact"
        style={{
          marginBottom: '1rem',
          display: 'grid',
          gridTemplateColumns: '1fr 220px',
          gap: '0.75rem',
          alignItems: 'end'
        }}
      >
        <div style={{ position: 'relative' }}>
          <svg
            className="search-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            className="search-input"
            placeholder="Buscar por paciente, odontólogo o estado..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            style={{ paddingRight: '1rem' }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label style={{ fontSize: '0.85rem', color: '#546e7a' }}>Filtrar por fecha</label>
          <input
            type="date"
            className="search-input finance-date-input"
            value={dateFilter}
            onChange={(event) => setDateFilter(event.target.value)}
          />
        </div>
      </div>

      {isError && (
        <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
          <div style={{ marginBottom: '0.75rem', fontWeight: 600 }}>No se pudieron cargar las citas</div>
          <div style={{ marginBottom: '0.75rem' }}>Verifica la sesión o la conexión con el backend e intenta nuevamente.</div>
          <button type="button" className="btn btn-secondary" onClick={() => refetch()}>
            Reintentar
          </button>
        </div>
      )}

      {isLoading ? (
        <LoadingState />
      ) : (
        <CitasTable
          citas={isError ? [] : filteredCitas}
          pacientes={pacientes}
          doctores={doctores}
          tratamientos={tratamientos}
          onEdit={handleEditCita}
          onDelete={handleDeleteCita}
          onView={handleViewCita}
          isLoading={false}
        />
      )}

      <CitaModal
        key={`${modalMode}-${selectedCita?.id || 'new-cita'}-${isModalOpen ? 'open' : 'closed'}`}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedCita(null);
          setModalMode('create');
        }}
        onSubmit={handleSubmitModal}
        initialData={selectedCita}
        isLoading={isSaving}
        pacientes={pacientes}
        doctores={doctores}
        tratamientos={tratamientos}
        readOnly={modalMode === 'view'}
        isEditing={modalMode === 'edit'}
        externalErrors={serverFormErrors}
      />
      <ConfirmModal
        isOpen={confirmOpen}
        title="Eliminar Cita"
        message={confirmError || `¿Eliminar la cita de ${getPacienteNombre(pendingDelete || {}, pacientes)}?`}
        onConfirm={confirmDeleteCita}
        onCancel={() => { setConfirmOpen(false); setPendingDelete(null); setConfirmError(''); }}
        isLoading={isDeleting}
      />
    </div>
  );
}
