import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createTratamiento, deleteTratamiento, fetchTratamientos, updateTratamiento } from '../../services/tratamientos';
import TratamientosTable from '../../components/tratamientos/TratamientosTable';
import TratamientoModal from '../../components/tratamientos/TratamientoModal';
import ConfirmModal from '../../components/ui/ConfirmModal';
import ErrorState from '../../components/feedback/ErrorState';

const TRATAMIENTOS_POR_PAGINA = 15;

export default function TratamientosPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTratamiento, setSelectedTratamiento] = useState(null);
  const [isViewMode, setIsViewMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [modalServerError, setModalServerError] = useState('');
  const [modalFieldErrors, setModalFieldErrors] = useState({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmError, setConfirmError] = useState('');

  const { data: tratamientos = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['tratamientos'], queryFn: fetchTratamientos
  });

  const filteredTratamientos = useMemo(() => {
    const s = searchTerm.trim().toLowerCase();
    if (!s) return tratamientos;
    return tratamientos.filter((t) =>
      (t.area || '').toLowerCase().includes(s) || (t.nombre || '').toLowerCase().includes(s) ||
      (t.descripcion || '').toLowerCase().includes(s) || String(t.precio || '').toLowerCase().includes(s)
    );
  }, [searchTerm, tratamientos]);

  const totalPages = Math.max(1, Math.ceil(filteredTratamientos.length / TRATAMIENTOS_POR_PAGINA));
  const paginatedTratamientos = useMemo(() => {
    const start = (currentPage - 1) * TRATAMIENTOS_POR_PAGINA;
    return filteredTratamientos.slice(start, start + TRATAMIENTOS_POR_PAGINA);
  }, [currentPage, filteredTratamientos]);

  useEffect(() => { setCurrentPage(1); }, [searchTerm]);
  useEffect(() => { setCurrentPage((p) => Math.min(p, totalPages)); }, [totalPages]);

  const openCreateModal = () => { setSelectedTratamiento(null); setIsViewMode(false); setModalServerError(''); setModalFieldErrors({}); setIsModalOpen(true); };
  const openEditModal = (t) => { setSelectedTratamiento(t); setIsViewMode(false); setModalServerError(''); setModalFieldErrors({}); setIsModalOpen(true); };
  const handleDeleteTratamiento = (t) => { setPendingDelete(t); setConfirmError(''); setConfirmOpen(true); };
  const handleViewTratamiento = (t) => { setSelectedTratamiento(t); setIsViewMode(true); setModalServerError(''); setIsModalOpen(true); };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      await deleteTratamiento(pendingDelete.id);
      queryClient.invalidateQueries({ queryKey: ['tratamientos'] });
      setConfirmOpen(false); setPendingDelete(null);
    } catch (error) {
      const raw = String(error.message || 'Error');
      let friendly = 'No se pudo eliminar el tratamiento.';
      if (raw.toLowerCase().includes('violates foreign key') || raw.toLowerCase().includes('foreign key constraint'))
        friendly = 'No se puede eliminar el tratamiento porque se asignó en alguna cita.';
      setConfirmError(friendly);
    } finally { setIsDeleting(false); }
  };

  const handleSaveTratamiento = async (payload) => {
    setIsSaving(true); setModalServerError('');
    try {
      if (selectedTratamiento?.id) await updateTratamiento(selectedTratamiento.id, payload);
      else await createTratamiento(payload);
      setIsModalOpen(false); setSelectedTratamiento(null);
      queryClient.invalidateQueries({ queryKey: ['tratamientos'] });
    } catch (error) {
      const serverMsg = error?.message || 'No se pudo guardar el tratamiento.';
      setModalServerError(serverMsg);
    } finally { setIsSaving(false); }
  };

  if (isError) return <ErrorState onRetry={refetch} />;

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1>Gestión de Tratamientos</h1><p>Administra los tratamientos disponibles</p></div>
        <button type="button" className="btn btn-primary" onClick={openCreateModal}>+ Nuevo Tratamiento</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label style={{ fontWeight: 700, fontSize: '0.85rem' }}>Búsqueda</label>
        <div className="search-container">
          <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input type="text" className="search-input" placeholder="Buscar por área, nombre, precio o descripción..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
      </div>
      <TratamientosTable tratamientos={paginatedTratamientos} isLoading={isLoading} onView={handleViewTratamiento} onEdit={openEditModal} onDelete={handleDeleteTratamiento} />
      {!isLoading && filteredTratamientos.length > 0 && (
        <div className="finance-pagination">
          <div className="finance-pagination__info">Mostrando {Math.min(filteredTratamientos.length, (currentPage - 1) * TRATAMIENTOS_POR_PAGINA + 1)}-{Math.min(filteredTratamientos.length, currentPage * TRATAMIENTOS_POR_PAGINA)} de {filteredTratamientos.length}</div>
          <div className="finance-pagination__controls">
            <button className="btn btn-secondary" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage <= 1}>Anterior</button>
            <span className="finance-pagination__page">Página {currentPage} de {totalPages}</span>
            <button className="btn btn-secondary" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}>Siguiente</button>
          </div>
        </div>
      )}
      <TratamientoModal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setSelectedTratamiento(null); setIsViewMode(false); setModalServerError(''); }}
        onSubmit={handleSaveTratamiento} initialData={selectedTratamiento} isLoading={isSaving} readOnly={isViewMode}
        serverError={modalServerError} clearServerError={() => setModalServerError('')}
        serverFieldErrors={modalFieldErrors} clearServerFieldErrors={(f) => setModalFieldErrors((p) => { const n = { ...p }; if (f) delete n[f]; return n; })} />
      <ConfirmModal isOpen={confirmOpen} title="Eliminar Tratamiento" message={confirmError || `¿Eliminar el tratamiento "${pendingDelete?.nombre || ''}"?`}
        onConfirm={confirmDelete} onCancel={() => { setConfirmOpen(false); setPendingDelete(null); setConfirmError(''); }} isLoading={isDeleting} />
    </div>
  );
}
