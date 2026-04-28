import { useMemo, useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createTratamiento,
  deleteTratamiento,
  fetchTratamientos,
  updateTratamiento
} from '../../services/api/tratamientos';
import TratamientosTable from '../../components/tratamientos/TratamientosTable';
import TratamientoModal from '../../components/tratamientos/TratamientoModal';
import ConfirmModal from '../../components/ui/ConfirmModal';
import ErrorState from '../../components/feedback/ErrorState';

export default function TratamientosPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTratamiento, setSelectedTratamiento] = useState(null);
  const [isViewMode, setIsViewMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [modalServerError, setModalServerError] = useState('');
  const errorTimerRef = useRef(null);

  const clearErrorTimer = () => {
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current);
      errorTimerRef.current = null;
    }
  };

  const showError = (msg, ms = 5000) => {
    clearErrorTimer();
    setErrorMessage(msg);
    if (msg) {
      errorTimerRef.current = setTimeout(() => {
        setErrorMessage('');
        errorTimerRef.current = null;
      }, ms);
    }
  };
  const [modalFieldErrors, setModalFieldErrors] = useState({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmError, setConfirmError] = useState('');

  const { data: tratamientos = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['tratamientos'],
    queryFn: fetchTratamientos
  });

  const filteredTratamientos = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    if (!normalizedSearch) return tratamientos;

    return tratamientos.filter((tratamiento) => {
      const area = (tratamiento.area || '').toLowerCase();
      const nombre = (tratamiento.nombre || '').toLowerCase();
      const descripcion = (tratamiento.descripcion || '').toLowerCase();
      const precio = String(tratamiento.precio || '').toLowerCase();

      return (
        area.includes(normalizedSearch)
        || nombre.includes(normalizedSearch)
        || descripcion.includes(normalizedSearch)
        || precio.includes(normalizedSearch)
      );
    });
  }, [searchTerm, tratamientos]);

  const openCreateModal = () => {
    setSelectedTratamiento(null);
    setIsViewMode(false);
    clearErrorTimer();
    setErrorMessage('');
    setModalServerError('');
    setModalFieldErrors({});
    setIsModalOpen(true);
  };

  const openEditModal = (tratamiento) => {
    setSelectedTratamiento(tratamiento);
    setIsViewMode(false);
    clearErrorTimer();
    setErrorMessage('');
    setModalServerError('');
    setModalFieldErrors({});
    setIsModalOpen(true);
  };

  const handleDeleteTratamiento = (tratamiento) => {
    // open confirmation modal
    setPendingDelete(tratamiento);
    setConfirmError('');
    setConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setIsDeleting(true);
    setConfirmError('');
    try {
      await deleteTratamiento(pendingDelete.id);
      queryClient.invalidateQueries({ queryKey: ['tratamientos'] });
      setConfirmOpen(false);
      setPendingDelete(null);
    } catch (error) {
      const raw = error.response?.data?.error || String(error.message || 'Error');
      // map known DB constraint message to user-friendly
      let friendly = 'No se pudo eliminar el tratamiento.';
      if (raw.toLowerCase().includes('violates foreign key') || raw.toLowerCase().includes('foreign key constraint')) {
        friendly = 'No se puede eliminar el tratamiento porque está en uso en otras entidades.';
      }
      setConfirmError(friendly);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleViewTratamiento = (tratamiento) => {
    setSelectedTratamiento(tratamiento);
    setIsViewMode(true);
    setErrorMessage('');
    setIsModalOpen(true);
  };

  const handleSaveTratamiento = async (payload) => {
    setIsSaving(true);
    setErrorMessage('');
    setModalServerError('');

    try {
      if (selectedTratamiento?.id) {
        await updateTratamiento(selectedTratamiento.id, payload);
      } else {
        await createTratamiento(payload);
      }

      setIsModalOpen(false);
      setSelectedTratamiento(null);
      queryClient.invalidateQueries({ queryKey: ['tratamientos'] });
    } catch (error) {
      const data = error.response?.data;
      const serverMsg = (typeof data === 'string' && data) || data?.error || 'No se pudo guardar el tratamiento.';
      // If backend returned field-level errors use them, otherwise show server message
      if (data && typeof data === 'object') {
        const maybeFieldErrors = data.error && typeof data.error === 'object' ? data.error : data.fieldErrors && typeof data.fieldErrors === 'object' ? data.fieldErrors : null;
        if (maybeFieldErrors) {
          setModalFieldErrors(maybeFieldErrors);
          setModalServerError('');
        } else {
          setModalServerError(serverMsg);
          setModalFieldErrors({});
        }
      } else {
        setModalServerError(serverMsg);
        setModalFieldErrors({});
      }
      setErrorMessage('');
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
          <h1>Gestión de Tratamientos</h1>
          <p>Administra los tratamientos disponibles</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreateModal}>
          + Nuevo Tratamiento
        </button>
      </div>

      {errorMessage && (
        <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
          {errorMessage}
        </div>
      )}

      <div className="search-container">
        <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          type="text"
          className="search-input"
          placeholder="Buscar por área, nombre, precio o descripción..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />
      </div>

      <TratamientosTable
        tratamientos={filteredTratamientos}
        isLoading={isLoading}
        onView={handleViewTratamiento}
        onEdit={openEditModal}
        onDelete={handleDeleteTratamiento}
      />

      <TratamientoModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedTratamiento(null);
          setIsViewMode(false);
          setModalServerError('');
        }}
        onSubmit={handleSaveTratamiento}
        initialData={selectedTratamiento}
        isLoading={isSaving}
        readOnly={isViewMode}
        serverError={modalServerError}
        clearServerError={() => setModalServerError('')}
        serverFieldErrors={modalFieldErrors}
        clearServerFieldErrors={(field) => setModalFieldErrors((prev) => {
          const next = { ...prev };
          if (field) delete next[field];
          return next;
        })}
      />
      <ConfirmModal
        isOpen={confirmOpen}
        title="Eliminar Tratamiento"
        message={confirmError || `¿Eliminar el tratamiento "${pendingDelete?.nombre || ''}"?`}
        onConfirm={confirmDelete}
        onCancel={() => { setConfirmOpen(false); setPendingDelete(null); setConfirmError(''); }}
        isLoading={isDeleting}
      />
    </div>
  );
}
