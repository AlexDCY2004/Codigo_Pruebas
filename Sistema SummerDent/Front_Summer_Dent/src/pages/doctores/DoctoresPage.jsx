import { useMemo, useState } from 'react';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createDoctor, deleteDoctor, fetchDoctores, updateDoctor } from '../../services/api/doctores';
import DoctoresTable from '../../components/doctores/DoctoresTable';
import DoctorModal from '../../components/doctores/DoctorModal';
import ErrorState from '../../components/feedback/ErrorState';

export default function DoctoresPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [isViewMode, setIsViewMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [modalErrorMessage, setModalErrorMessage] = useState('');
  const [modalFieldErrors, setModalFieldErrors] = useState({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmError, setConfirmError] = useState('');

  const { data: doctores = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['doctores'],
    queryFn: fetchDoctores
  });

  const filteredDoctores = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    if (!normalizedSearch) return doctores;

    return doctores.filter((doctor) => {
      const nombre = (doctor.nombre || '').toLowerCase();
      const especialidad = (doctor.especialidad || '').toLowerCase();
      const correo = (doctor.correo || '').toLowerCase();
      const telefono = String(doctor.telefono || '').toLowerCase();

      return (
        nombre.includes(normalizedSearch)
        || especialidad.includes(normalizedSearch)
        || correo.includes(normalizedSearch)
        || telefono.includes(normalizedSearch)
      );
    });
  }, [doctores, searchTerm]);

  const openCreateModal = () => {
    setSelectedDoctor(null);
    setIsViewMode(false);
    setModalErrorMessage('');
    setModalFieldErrors({});
    setIsModalOpen(true);
  };

  const openEditModal = (doctor) => {
    setSelectedDoctor(doctor);
    setIsViewMode(false);
    setModalErrorMessage('');
    setModalFieldErrors({});
    setIsModalOpen(true);
  };

  const handleDeleteDoctor = (doctor) => {
    setPendingDelete(doctor);
    setConfirmError('');
    setConfirmOpen(true);
  };

  const confirmDeleteDoctor = async () => {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      await deleteDoctor(pendingDelete.id);
      queryClient.invalidateQueries({ queryKey: ['doctores'] });
      setConfirmOpen(false);
      setPendingDelete(null);
    } catch (error) {
      const raw = error.response?.data?.error || String(error.message || 'Error');
      let friendly = 'No se pudo eliminar el odontólogo.';
      if (raw.toLowerCase().includes('violates foreign key') || raw.toLowerCase().includes('foreign key constraint')) {
        friendly = 'No se puede eliminar el odontólogo porque está en uso en otras entidades.';
      }
      setConfirmError(friendly);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleViewDoctor = (doctor) => {
    setSelectedDoctor(doctor);
    setIsViewMode(true);
    setModalErrorMessage('');
    setModalFieldErrors({});
    setIsModalOpen(true);
  };

  const handleSaveDoctor = async (payload) => {
    setIsSaving(true);
    setModalErrorMessage('');
    setModalFieldErrors({});

    try {
      if (selectedDoctor?.id) {
        await updateDoctor(selectedDoctor.id, payload);
      } else {
        await createDoctor(payload);
      }

      setIsModalOpen(false);
      setSelectedDoctor(null);
      setModalErrorMessage('');
      setModalFieldErrors({});
      queryClient.invalidateQueries({ queryKey: ['doctores'] });
    } catch (error) {
      const serverMsg = error.response?.data?.error || 'No se pudo guardar el odontólogo.';
      const msgLower = String(serverMsg).toLowerCase();
      const fieldErrs = {};

      if (msgLower.includes('nombre')) fieldErrs.nombre = serverMsg;
      if (msgLower.includes('telefono') || msgLower.includes('teléfono')) fieldErrs.telefono = serverMsg;
      if (msgLower.includes('correo')) fieldErrs.correo = serverMsg;
      if (msgLower.includes('especialidad')) fieldErrs.especialidad = serverMsg;
      if (msgLower.includes('estado')) fieldErrs.estado = serverMsg;

      if (Object.keys(fieldErrs).length > 0) {
        setModalFieldErrors(fieldErrs);
      } else {
        setModalErrorMessage(serverMsg);
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (isError) {
    return <ErrorState onRetry={refetch} />;
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Gestión de Odontólogos</h1>
          <p>Administra los odontólogos del consultorio</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreateModal}>
          + Nuevo Odontólogo
        </button>
      </div>

      <div className="search-container">
        <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          type="text"
          className="search-input"
          placeholder="Buscar por nombre, teléfono, correo o especialidad..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />
      </div>

      <DoctoresTable
        doctores={filteredDoctores}
        isLoading={isLoading}
        onView={handleViewDoctor}
        onEdit={openEditModal}
        onDelete={handleDeleteDoctor}
      />

      <DoctorModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedDoctor(null);
          setIsViewMode(false);
          setModalErrorMessage('');
          setModalFieldErrors({});
        }}
        onSubmit={handleSaveDoctor}
        initialData={selectedDoctor}
        isLoading={isSaving}
        readOnly={isViewMode}
        externalErrors={modalFieldErrors}
        externalError={modalErrorMessage}
      />
      <ConfirmModal
        isOpen={confirmOpen}
        title="Eliminar Odontólogo"
        message={confirmError || `¿Eliminar al odontólogo "${pendingDelete?.nombre || ''}"?`}
        onConfirm={confirmDeleteDoctor}
        onCancel={() => { setConfirmOpen(false); setPendingDelete(null); setConfirmError(''); }}
        isLoading={isDeleting}
      />
    </div>
  );
}
