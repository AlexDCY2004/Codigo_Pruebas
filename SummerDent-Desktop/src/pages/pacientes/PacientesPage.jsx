import { useEffect, useMemo, useState } from 'react';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchPacientes, createPaciente, updatePaciente, deletePaciente } from '../../services/pacientes';
import PacientesTable from '../../components/pacientes/PacientesTable';
import PacienteModal from '../../components/pacientes/PacienteModal';
import ErrorState from '../../components/feedback/ErrorState';
import LoadingState from '../../components/feedback/LoadingState';

const PACIENTES_POR_PAGINA = 15;

export default function PacientesPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPaciente, setSelectedPaciente] = useState(null);
  const [modalMode, setModalMode] = useState('create');
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

  const filteredPacientes = useMemo(() => {
    const search = searchTerm.toLowerCase();
    return pacientes.filter((p) => {
      const fullName = `${p.nombre} ${p.apellido}`.toLowerCase();
      const cedula = (p.id_cedula || '').toString();
      return fullName.includes(search) || cedula.includes(search);
    });
  }, [pacientes, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredPacientes.length / PACIENTES_POR_PAGINA));

  const paginatedPacientes = useMemo(() => {
    const startIndex = (currentPage - 1) * PACIENTES_POR_PAGINA;
    return filteredPacientes.slice(startIndex, startIndex + PACIENTES_POR_PAGINA);
  }, [currentPage, filteredPacientes]);

  useEffect(() => { setCurrentPage(1); }, [searchTerm]);
  useEffect(() => { setCurrentPage((page) => Math.min(page, totalPages)); }, [totalPages]);

  const handleClearFieldError = (field) => {
    setModalFieldErrors(prev => ({ ...prev, [field]: '' }));
  };

  const handleNewPaciente = () => {
    setSelectedPaciente(null);
    setModalMode('create');
    setIsModalOpen(true);
  };

  const handleEditPaciente = (paciente) => {
    setSelectedPaciente({
      ...paciente,
      fecha_nacimiento: paciente.fecha_nacimiento ? (function(val){
        if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
        const d = new Date(val);
        if (Number.isNaN(d.getTime())) return '';
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      })(paciente.fecha_nacimiento) : ''
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
      const raw = err?.message || JSON.stringify(err) || 'Error al eliminar el paciente';
      let friendly = 'No se pudo eliminar el paciente.';
      if (String(raw).toLowerCase().includes('foreign key') || String(raw).toLowerCase().includes('violates')) {
        friendly = 'No se puede eliminar el paciente porque está en uso en otras entidades.';
      }
      setConfirmError(friendly);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleViewPaciente = (paciente) => {
    setSelectedPaciente({
      ...paciente,
      fecha_nacimiento: paciente.fecha_nacimiento ? (function(val){
        if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
        const d = new Date(val);
        if (Number.isNaN(d.getTime())) return '';
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      })(paciente.fecha_nacimiento) : ''
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
      const serverMsg = err?.message || JSON.stringify(err) || 'Error al guardar el paciente';
      const msgLower = String(serverMsg).toLowerCase();
      const fieldErrs = {};
      if (msgLower.includes('cedula') || msgLower.includes('cédula')) fieldErrs.id_cedula = serverMsg;
      if (msgLower.includes('nombre')) fieldErrs.nombre = serverMsg;
      if (msgLower.includes('apellido')) fieldErrs.apellido = serverMsg;
      if (msgLower.includes('fecha') || msgLower.includes('nacimiento')) fieldErrs.fecha_nacimiento = serverMsg;
      if (msgLower.includes('telefono') || msgLower.includes('teléfono')) fieldErrs.telefono = serverMsg;
      if (msgLower.includes('correo')) fieldErrs.correo = serverMsg;
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
    const err = queryError;
    const serverMsg = err?.message || JSON.stringify(err) || 'Error al obtener pacientes';
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label style={{ fontWeight: 700, fontSize: '0.85rem' }}>Búsqueda</label>
        <div className="search-container">
          <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input type="text" className="search-input" placeholder="Buscar por nombre o cédula..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : (
        <>
          <PacientesTable pacientes={paginatedPacientes} onEdit={handleEditPaciente} onDelete={handleDeletePaciente} onView={handleViewPaciente} isLoading={false} />

          {filteredPacientes.length > 0 && (
            <div className="finance-pagination">
              <div className="finance-pagination__info">
                Mostrando {Math.min(filteredPacientes.length, (currentPage - 1) * PACIENTES_POR_PAGINA + 1)}-
                {Math.min(filteredPacientes.length, currentPage * PACIENTES_POR_PAGINA)} de {filteredPacientes.length}
              </div>
              <div className="finance-pagination__controls">
                <button className="btn btn-secondary" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage <= 1}>Anterior</button>
                <span className="finance-pagination__page">Página {currentPage} de {totalPages}</span>
                <button className="btn btn-secondary" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={currentPage >= totalPages}>Siguiente</button>
              </div>
            </div>
          )}
        </>
      )}

      <PacienteModal
        key={`${selectedPaciente?.id_cedula ?? 'new'}-${isModalOpen}`}
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setSelectedPaciente(null); setModalFieldErrors({}); }}
        onSubmit={handleSubmitModal}
        initialData={selectedPaciente}
        isLoading={isSaving}
        readOnly={modalMode === 'view'}
        isEditing={modalMode === 'edit'}
        externalErrors={modalFieldErrors}
        onClearExternalError={handleClearFieldError}
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
