import apiClient from './client';

const getToday = () => new Date().toISOString().slice(0, 10);
const getCurrentMonth = () => getToday().slice(0, 7);

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeStatus = (value) => {
  const status = String(value || '').toLowerCase();
  if (status.includes('confirm')) return 'confirmada';
  if (status.includes('pend')) return 'pendiente';
  return status || 'pendiente';
};

const trimTime = (value) => String(value || '').slice(0, 5);

const sumMonthAmount = (rows, monthRef) =>
  rows
    .filter((item) => String(item?.fecha || '').startsWith(monthRef))
    .reduce((sum, item) => sum + toNumber(item?.monto), 0);

export async function fetchDashboardSnapshot() {
  const [citasRes, ingresosRes, egresosRes] = await Promise.allSettled([
    apiClient.get('/api/citas'),
    apiClient.get('/api/movimientos-finanzas/ingresos'),
    apiClient.get('/api/movimientos-finanzas/egresos')
  ]);

  const citas = citasRes.status === 'fulfilled' && Array.isArray(citasRes.value?.data) ? citasRes.value.data : [];
  const ingresos = ingresosRes.status === 'fulfilled' && Array.isArray(ingresosRes.value?.data) ? ingresosRes.value.data : [];
  const egresos = egresosRes.status === 'fulfilled' && Array.isArray(egresosRes.value?.data) ? egresosRes.value.data : [];

  const today = getToday();
  const monthRef = getCurrentMonth();

  const citasHoy = citas.filter((item) => item?.fecha === today).length;
  const totalIngresos = sumMonthAmount(ingresos, monthRef);
  const totalEgresos = sumMonthAmount(egresos, monthRef);
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
