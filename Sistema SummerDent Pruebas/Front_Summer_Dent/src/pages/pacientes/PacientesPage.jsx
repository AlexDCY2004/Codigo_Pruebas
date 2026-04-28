import { useEffect, useState } from 'react';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchPacientes, createPaciente, updatePaciente, deletePaciente } from '../../services/api/pacientes';
import PacientesTable from '../../components/pacientes/PacientesTable';
import PacienteModal from '../../components/pacientes/PacienteModal';
import ErrorState from '../../components/feedback/ErrorState';
import LoadingState from '../../components/feedback/LoadingState';

export default function PacientesPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPaciente, setSelectedPaciente] = useState(null);
  const [modalMode, setModalMode] = useState('create'); // 'create' | 'edit' | 'view'
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [modalFieldErrors, setModalFieldErrors] = useState({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmError, setConfirmError] = useState('');

  const { data: pacientes = [], isLoading, isError, error: queryError, refetch } = useQuery({
    queryKey: ['pacientes'],
    queryFn: fetchPacientes
  });

  const filteredPacientes = pacientes.filter(p => {
    const fullName = `${p.nombre} ${p.apellido}`.toLowerCase();
    const cedula = (p.id_cedula || '').toString();
    const search = searchTerm.toLowerCase();
    return fullName.includes(search) || cedula.includes(search);
  });

  const handleNewPaciente = () => {
    setSelectedPaciente(null);
    setModalMode('create');
    setIsModalOpen(true);
  };

  const handleEditPaciente = (paciente) => {
    setSelectedPaciente({
      ...paciente,
      fecha_nacimiento: paciente.fecha_nacimiento ? 
        new Date(paciente.fecha_nacimiento).toISOString().split('T')[0] : ''
    });
    setModalMode('edit');
    setIsModalOpen(true);
  };

  const handleDeletePaciente = (paciente) => {
    setPendingDelete(paciente);
    setConfirmError('');
    setConfirmOpen(true);
  };

  const confirmDeletePaciente = async () => {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      await deletePaciente(pendingDelete.id_cedula);
      queryClient.invalidateQueries({ queryKey: ['pacientes'] });
      setConfirmOpen(false);
      setPendingDelete(null);
    } catch (err) {
      const raw = err?.response?.data?.error || err?.response?.data?.message || err?.message || JSON.stringify(err?.response?.data) || 'Error al eliminar el paciente';
      let friendly = 'No se pudo eliminar el paciente.';
      if (String(raw).toLowerCase().includes('foreign key') || String(raw).toLowerCase().includes('violates')) {
        friendly = 'No se puede eliminar el paciente porque está en uso en otras entidades.';
      }
      setConfirmError(friendly);
      console.error('Error deleting paciente:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleViewPaciente = (paciente) => {
    setSelectedPaciente({
      ...paciente,
      fecha_nacimiento: paciente.fecha_nacimiento ? new Date(paciente.fecha_nacimiento).toISOString().split('T')[0] : ''
    });
    setModalMode('view');
    setIsModalOpen(true);
  };

  const handleSubmitModal = async (formData) => {
    setIsSaving(true);
    setError(null);
    setModalFieldErrors({});
    try {
      if (selectedPaciente?.id_cedula) {
        // When editing, do NOT send id_cedula in the body (it's the resource identifier)
        const payload = { ...formData };
        if (payload.id_cedula !== undefined) delete payload.id_cedula;
        await updatePaciente(selectedPaciente.id_cedula, payload);
      } else {
        await createPaciente(formData);
      }
      setIsModalOpen(false);
      setSelectedPaciente(null);
      queryClient.invalidateQueries({ queryKey: ['pacientes'] });
    } catch (err) {
      const serverMsg = err?.response?.data?.error || err?.response?.data?.message || err?.message || JSON.stringify(err?.response?.data) || 'Error al guardar el paciente';
      console.error('Error saving paciente:', err);

      const msgLower = String(serverMsg).toLowerCase();
      const fieldErrs = {};
      if (msgLower.includes('cedula') || msgLower.includes('cédula')) fieldErrs.id_cedula = serverMsg;
      if (msgLower.includes('nombre')) fieldErrs.nombre = serverMsg;
      if (msgLower.includes('apellido')) fieldErrs.apellido = serverMsg;
      if (msgLower.includes('fecha') || msgLower.includes('nacimiento')) fieldErrs.fecha_nacimiento = serverMsg;
      if (msgLower.includes('telefono') || msgLower.includes('teléfono')) fieldErrs.telefono = serverMsg;
      if (msgLower.includes('correo')) fieldErrs.correo = serverMsg;
      if (msgLower.includes('direccion') || msgLower.includes('dirección')) fieldErrs.direccion = serverMsg;

      if (Object.keys(fieldErrs).length > 0) {
        setModalFieldErrors(fieldErrs);
      } else {
        setError(serverMsg);
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (isError) {
    // Extract useful message from Axios error if present
    const err = queryError;
    const serverMsg = err?.response?.data?.error || err?.response?.data?.message || err?.message || JSON.stringify(err?.response?.data) || 'Error al obtener pacientes';
    return <ErrorState title="Ocurrió un error" message={serverMsg} onRetry={refetch} />;
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Gestión de Pacientes</h1>
          <p>Administra los pacientes del consultorio</p>
        </div>
        <button className="btn btn-primary" onClick={handleNewPaciente}>
          + Nuevo Paciente
        </button>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      <div className="search-container">
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
          placeholder="Buscar por nombre o cédula..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {isLoading ? (
        <LoadingState />
      ) : (
        <PacientesTable
          pacientes={filteredPacientes}
          onEdit={handleEditPaciente}
          onDelete={handleDeletePaciente}
          onView={handleViewPaciente}
          isLoading={false}
        />
      )}

      <PacienteModal
        key={selectedPaciente?.id_cedula || 'new-paciente'}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedPaciente(null);
          setModalFieldErrors({});
        }}
        onSubmit={handleSubmitModal}
        initialData={selectedPaciente}
        isLoading={isSaving}
        readOnly={modalMode === 'view'}
        isEditing={modalMode === 'edit'}
        externalErrors={modalFieldErrors}
      />
      <ConfirmModal
        isOpen={confirmOpen}
        title="Eliminar Paciente"
        message={confirmError || `¿Eliminar a ${pendingDelete?.nombre || ''} ${pendingDelete?.apellido || ''}?`}
        onConfirm={confirmDeletePaciente}
        onCancel={() => { setConfirmOpen(false); setPendingDelete(null); setConfirmError(''); }}
        isLoading={isDeleting}
      />
    </div>
  );
}
