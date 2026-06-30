import apiClient from './client';
import { useAuthStore } from '../../store/authStore';

const getToday = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeStatus = (value) => {
  const status = String(value || '').toLowerCase();
  if (status.includes('confirm')) return 'confirmada';
  if (status.includes('pend')) return 'agendada';
  return status || 'agendada';
};

const trimTime = (value) => String(value || '').slice(0, 5);

export async function fetchDashboardSnapshot(opts = {}) {
  const { desde, hasta } = opts || {};

  const sedeActiva = useAuthStore.getState().sedeActiva;
  const params = {};
  if (sedeActiva !== null && typeof sedeActiva !== 'undefined') params.sede_id = sedeActiva;

  const [citasRes, movimientosRes, pacientesRes, doctoresRes] = await Promise.allSettled([
    apiClient.get('/api/citas', { params }),
    apiClient.get('/api/movimientos-finanzas', { params: { ...params, desde: desde || undefined, hasta: hasta || undefined } }),
    apiClient.get('/api/pacientes', { params }),
    apiClient.get('/api/doctores', { params })
  ]);

  const citas = citasRes.status === 'fulfilled' && Array.isArray(citasRes.value?.data) ? citasRes.value.data : [];
  const movimientos = movimientosRes.status === 'fulfilled' && Array.isArray(movimientosRes.value?.data) ? movimientosRes.value.data : [];
  const pacientes = pacientesRes.status === 'fulfilled' && Array.isArray(pacientesRes.value?.data) ? pacientesRes.value.data : [];
  const doctores = doctoresRes.status === 'fulfilled' && Array.isArray(doctoresRes.value?.data) ? doctoresRes.value.data : [];

  const pacienteNombrePorCedula = new Map(
    pacientes.map((item) => {
      const fullName = [item?.nombre, item?.apellido].filter(Boolean).join(' ').trim();
      return [String(item?.id_cedula || ''), fullName || 'Paciente sin nombre'];
    })
  );

  const today = getToday();
  const citasHoy = citas.filter((item) => item?.fecha === today).length;
  const totalMovimientos = movimientos.reduce((sum, item) => sum + toNumber(item?.monto), 0);
  const totalIngresos = totalMovimientos;
  const totalDoctoresActivos = doctores.filter((d) => d?.estado === 'disponible').length;

  const upcomingAppointments = citas
    .filter((item) => String(item?.fecha || '') > today)
    .sort((a, b) => {
      const aKey = `${a?.fecha || ''} ${a?.hora_inicio || ''}`;
      const bKey = `${b?.fecha || ''} ${b?.hora_inicio || ''}`;
      return aKey.localeCompare(bKey);
    })
    .slice(0, 6)
    .map((item) => ({
      id: item?.id,
      patientName: pacienteNombrePorCedula.get(String(item?.id_paciente || '')) || `Paciente ID: ${item?.id_paciente || '-'}`,
      date: item?.fecha || today,
      start: trimTime(item?.hora_inicio),
      end: trimTime(item?.hora_fin),
      status: normalizeStatus(item?.estado)
    }));

  const todaysAppointments = citas
    .filter((item) => String(item?.fecha || '') === today)
    .sort((a, b) => {
      const aKey = `${a?.hora_inicio || ''}`;
      const bKey = `${b?.hora_inicio || ''}`;
      return aKey.localeCompare(bKey);
    })
    .slice(0, 6)
    .map((item) => ({
      id: item?.id,
      patientName: pacienteNombrePorCedula.get(String(item?.id_paciente || '')) || `Paciente ID: ${item?.id_paciente || '-'}`,
      date: item?.fecha || today,
      start: trimTime(item?.hora_inicio),
      end: trimTime(item?.hora_fin),
      status: normalizeStatus(item?.estado)
    }));

  return {
    summary: {
      citasHoy,
      totalMovimientos,
      totalIngresos,
      totalDoctoresActivos
    },
    appointments: upcomingAppointments,
    todaysAppointments: todaysAppointments,
    financial: {
      totalMovimientos
    }
  };
}
