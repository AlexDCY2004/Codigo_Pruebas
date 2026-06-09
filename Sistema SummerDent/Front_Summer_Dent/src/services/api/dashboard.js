import apiClient from './client';
import { useAuthStore } from '../../store/authStore';

const getToday = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
/*const getCurrentMonth = () => {
  const t = getToday();
  return t.slice(0, 7);
};*/

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

/*const sumMonthAmount = (rows, monthRef) =>
  rows
    .filter((item) => String(item?.fecha || '').startsWith(monthRef))
    .reduce((sum, item) => sum + toNumber(item?.monto), 0);*/

export async function fetchDashboardSnapshot(opts = {}) {
  // opts: { desde, hasta }
  const { desde, hasta } = opts || {};
  const qs = (tipo) => {
    const params = new URLSearchParams();
    params.set('tipo', tipo);
    if (desde) params.set('desde', desde);
    if (hasta) params.set('hasta', hasta);
    return `?${params.toString()}`;
  };

  const sedeActiva = useAuthStore.getState().sedeActiva;
  const params = {};
  if (sedeActiva !== null && typeof sedeActiva !== 'undefined') params.sede_id = sedeActiva;

  const [citasRes, ingresosRes, egresosRes, pacientesRes] = await Promise.allSettled([
    apiClient.get('/api/citas', { params }),
    apiClient.get(`/api/movimientos-finanzas${qs('ingreso')}`, { params }),
    apiClient.get(`/api/movimientos-finanzas${qs('egreso')}`, { params }),
    apiClient.get('/api/pacientes', { params })
  ]);

  const citas = citasRes.status === 'fulfilled' && Array.isArray(citasRes.value?.data) ? citasRes.value.data : [];
  const ingresos = ingresosRes.status === 'fulfilled' && Array.isArray(ingresosRes.value?.data) ? ingresosRes.value.data : [];
  const egresos = egresosRes.status === 'fulfilled' && Array.isArray(egresosRes.value?.data) ? egresosRes.value.data : [];
  const pacientes = pacientesRes.status === 'fulfilled' && Array.isArray(pacientesRes.value?.data) ? pacientesRes.value.data : [];

  const pacienteNombrePorCedula = new Map(
    pacientes.map((item) => {
      const fullName = [item?.nombre, item?.apellido].filter(Boolean).join(' ').trim();
      return [String(item?.id_cedula || ''), fullName || 'Paciente sin nombre'];
    })
  );

  const today = getToday();
  const citasHoy = citas.filter((item) => item?.fecha === today).length;
  // ingresos/egresos already filtered by backend when desde/hasta are provided
  const totalIngresos = ingresos.reduce((sum, item) => sum + toNumber(item?.monto), 0);
  const totalEgresos = egresos.reduce((sum, item) => sum + toNumber(item?.monto), 0);
  const balance = totalIngresos - totalEgresos;

  const upcomingAppointments = citas
    // only appointments after today (exclude today's appointments)
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
      totalIngresos,
      totalEgresos,
      balance
    },
    appointments: upcomingAppointments,
    todaysAppointments: todaysAppointments,
    financial: {
      ingresosMes: totalIngresos,
      egresosMes: totalEgresos
    }
  };
}
