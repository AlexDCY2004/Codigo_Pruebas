import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { fetchCajaMensual, createCajaMensual, updateCajaMensual, closeCajaMensual } from '../../services/api/cajaMensual';
import Button from '../../components/ui/Button';
import ConfirmModal from '../../components/ui/ConfirmModal';
import ErrorState from '../../components/feedback/ErrorState';


export default function CajaMensualPage({ onClose, initialAnio, initialMes } = {}) {
  const qc = useQueryClient();
  const sedeActiva = useAuthStore((s) => s.sedeActiva);
  const [anio, setAnio] = useState(null);
  const [mes, setMes] = useState(null);
  const [saldoInicialEdit, setSaldoInicialEdit] = useState('');
  const [isConfirmCloseOpen, setIsConfirmCloseOpen] = useState(false);

  const { data: cajaActual, isError, refetch } = useQuery({
    queryKey: ['caja-mensual', sedeActiva, anio, mes], // sedeActiva incluido
    queryFn: () => fetchCajaMensual({ anio, mes }),
    enabled: !!sedeActiva && !!anio && !!mes // solo ejecuta si los tres tienen valor
  });

  useEffect(() => {
    const now = new Date();
    setAnio(initialAnio ?? now.getFullYear());
    setMes(initialMes ?? (now.getMonth() + 1));
  }, [initialAnio, initialMes]);

  useEffect(() => {
    if (cajaActual) {
      setSaldoInicialEdit(cajaActual.saldo_inicial ?? 0);
    }
  }, [cajaActual]);

  const [saveLoading, setSaveLoading] = useState(false);
  const [closeLoading, setCloseLoading] = useState(false);

  const handleUpdate = async (id, payload) => {
    setSaveLoading(true);
    try {
      await updateCajaMensual(id, payload);
      qc.invalidateQueries(['caja-mensual', sedeActiva]);
      qc.invalidateQueries(['caja-mensual-history', sedeActiva]);
      qc.invalidateQueries(['caja-mensual-dashboard', sedeActiva, anio, mes]);
      await refetch();
      if (typeof onClose === 'function') onClose();
      return true;
    } catch (err) {
      console.error('Error updating caja mensual', err);
      const msg = err?.response?.data?.error || err?.message || 'Error al guardar';
      alert(msg);
      return false;
    } finally {
      setSaveLoading(false);
    }
  };

  const handleCreate = async (payload) => {
    setSaveLoading(true);
    try {
      await createCajaMensual(payload);
      qc.invalidateQueries(['caja-mensual', sedeActiva]);
      qc.invalidateQueries(['caja-mensual-history', sedeActiva]);
      qc.invalidateQueries(['caja-mensual-dashboard', sedeActiva, anio, mes]);
      await refetch();
      if (typeof onClose === 'function') onClose();
      return true;
    } catch (err) {
      console.error('Error creating caja mensual', err);
      const msg = err?.response?.data?.error || err?.message || 'Error al crear registro';
      alert(msg);
      return false;
    } finally {
      setSaveLoading(false);
    }
  };

  const handleClose = async (id) => {
    setCloseLoading(true);
    try {
      await closeCajaMensual(id);
      qc.invalidateQueries(['caja-mensual', sedeActiva]);
      qc.invalidateQueries(['caja-mensual-history', sedeActiva]);
      qc.invalidateQueries(['caja-mensual-dashboard', sedeActiva, anio, mes]);
      await refetch();
      if (typeof onClose === 'function') onClose();
      return true;
    } catch (err) {
      console.error('Error closing caja mensual', err);
      const msg = err?.response?.data?.error || err?.message || 'Error al cerrar mes';
      alert(msg);
      return false;
    } finally {
      setCloseLoading(false);
    }
  };

  const handleSaveSaldoInicial = async () => {
    const value = Number(saldoInicialEdit || 0);
    if (cajaActual) {
      const payload = { saldo_inicial: value };
      await handleUpdate(cajaActual.id, payload);
    } else {
      const payload = { anio, mes, saldo_inicial: value };
      if (sedeActiva) payload.sede_id = sedeActiva;
      await handleCreate(payload);
    }
  };

  const handleCloseMonth = () => {
    if (!cajaActual) return;
    setIsConfirmCloseOpen(true);
  };

  const confirmClose = async () => {
    if (!cajaActual) return;
    await handleClose(cajaActual.id);
    setIsConfirmCloseOpen(false);
  };

  if (isError) return <ErrorState onRetry={refetch} />;

  return (
    <div className="finance-form page-container" style={{ maxWidth: 980 }}>
      <div className="page-header page-header--finance" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ margin: 0 }}>Caja Mensual</h2>
          <p style={{ margin: '6px 0 0', color: '#556' }}>Resumen por sede y mes. Modifica el saldo inicial aquí.</p>
        </div>
        <div>
          <Button variant="secondary" onClick={handleCloseMonth} disabled={!cajaActual || cajaActual.cerrado}>
            {cajaActual?.cerrado ? 'Mes cerrado' : 'Cerrar mes'}
          </Button>
        </div>
      </div>

      <div style={{ marginTop: '1rem' }}>
        <label style={{ display: 'block', marginBottom: 8, fontWeight: 700, color: '#1d3354' }}>Saldo Inicial</label>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <input
            className="finance-form-input"
            type="number"
            value={saldoInicialEdit}
            onChange={(e) => setSaldoInicialEdit(e.target.value)}
          />
          <Button onClick={handleSaveSaldoInicial} disabled={saveLoading}>
            {saveLoading ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      </div>

      <ConfirmModal
        isOpen={isConfirmCloseOpen}
        title="Cerrar mes"
        message="¿Estás seguro que deseas cerrar el mes? Esta acción marcará el mes como cerrado y creará el registro del siguiente mes con el saldo final como saldo inicial."
        onConfirm={confirmClose}
        onCancel={() => setIsConfirmCloseOpen(false)}
        isLoading={closeLoading}
        confirmLabel="Cerrar mes"
      />
    </div>
  );
}