import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

const estadosPermitidos = ['agendada', 'confirmada', 'Atendida', 'cancelada'];

const getLocalDateYYYYMMDD = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getDateOffsetMonths = (months) => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setMonth(date.getMonth() + months);
  return getLocalDateYYYYMMDD(date);
};

export const getCitaDateWindow = () => ({
  minDate: getDateOffsetMonths(-2),
  maxDate: getDateOffsetMonths(3)
});

export const esFechaCitaDentroDeVentana = (fecha) => {
  if (!fecha) return false;
  const value = String(fecha).slice(0, 10);
  const { minDate, maxDate } = getCitaDateWindow();
  return value >= minDate && value <= maxDate;
};

export const calcularPrecioTratamientos = async (tratamientosIds) => {
  if (!Array.isArray(tratamientosIds) || tratamientosIds.length === 0) return 0;
  const ids = tratamientosIds.map((t) => Number(t));
  const { data, error } = await supabase.from('tratamiento').select('id, precio').in('id', ids);
  if (error) throw error;
  if (!data || data.length !== ids.length) {
    const encontrados = (data || []).map((t) => Number(t.id));
    const faltantes = ids.filter((x) => !encontrados.includes(x));
    throw new Error(`Tratamientos no encontrados: ${faltantes.join(', ')}`);
  }
  return data.reduce((s, t) => s + Number(t.precio || 0), 0);
};

export const getTratamientosNombres = async (tratamientosIds) => {
  if (!Array.isArray(tratamientosIds) || tratamientosIds.length === 0) return '';
  const ids = tratamientosIds.map((t) => Number(t));
  const { data } = await supabase.from('tratamiento').select('nombre').in('id', ids);
  if (!data) return '';
  return data.map((t) => t.nombre).filter(Boolean).join(', ');
};

export const crearCitaConTratamientos = async (formData) => {
  const user = useAuthStore.getState().user;
  const sedeActiva = useAuthStore.getState().sedeActiva;

  // Extraemos limpiamente los datos aquí adentro
  const { tratamiento_id, metodo_pago, detalle_pago, ...citaData } = formData;
  const tratamientosIds = Array.isArray(tratamiento_id) && tratamiento_id.length > 0 ? tratamiento_id : null;

  const payload = {
    ...citaData,
    sede_id: citaData.sede_id ?? sedeActiva ?? null,
    id_perfil: user?.id ?? null
  };

  const { data: newCita, error } = await supabase.from('cita').insert([payload]).select();
  if (error) throw error;
  const cita = newCita?.[0];
  if (!cita) throw new Error('No se pudo crear la cita');

  let montoTotal = 0;
  let nombresTratamientos = '';

  if (tratamientosIds) {
    const ids = tratamientosIds.map((t) => Number(t));
    const { data: tratamientosData } = await supabase.from('tratamiento').select('id, precio, nombre').in('id', ids);
    if (!tratamientosData || tratamientosData.length !== ids.length) {
      await supabase.from('cita').delete().eq('id', cita.id);
      throw new Error('Tratamientos no encontrados');
    }

    montoTotal = tratamientosData.reduce((s, t) => s + Number(t.precio || 0), 0);
    nombresTratamientos = tratamientosData.map((t) => t.nombre).filter(Boolean).join(', ');

    const junctionPayload = tratamientosData.map((t) => ({
      cita_id: cita.id,
      tratamiento_id: Number(t.id),
      precio: Number(t.precio || 0),
      cantidad: 1
    }));

    const { error: jErr } = await supabase.from('cita_tratamiento').insert(junctionPayload);
    if (jErr) {
      await supabase.from('cita').delete().eq('id', cita.id);
      throw jErr;
    }

    if (nombresTratamientos) {
      await supabase.from('cita').update({ tratamientos: nombresTratamientos }).eq('id', cita.id);
    }
  }

  // Si la cita se crea directamente en estado "Atendida"
  if (String(cita.estado).toLowerCase() === 'atendida' || cita.estado === 'Atendida') {
    const perfilId = user?.id || null;
    const citaFecha = cita.fecha || getLocalDateYYYYMMDD();

    const movimientoPayload = {
      tipo: 'ingreso',
      id_perfil: perfilId,
      id_doctor: Number(cita.id_doctor),
      monto: montoTotal, 
      descripcion: detalle_pago || (nombresTratamientos ? `consulta de: ${nombresTratamientos}` : 'Consulta Odontológica'),
      fecha: citaFecha,
      sede_id: cita.sede_id || null,
      metodo_pago: metodo_pago || null
    };

    await supabase.from('movimiento_finanzas').insert([movimientoPayload]);
  }

  return cita;
};

export const actualizarCitaConTratamientos = async (citaId, formData) => {
  const { data: existing } = await supabase.from('cita').select('*').eq('id', citaId).single();
  if (!existing) throw new Error('Cita no encontrada');
  if (String(existing.estado || '').toLowerCase() === 'atendida') {
    throw new Error('La cita ya fue atendida y no puede editarse.');
  }

  // Separamos AQUÍ adentro los campos limpios
  const { tratamiento_id, metodo_pago, detalle_pago, ...updates } = formData;
  const tratamientosIds = Array.isArray(tratamiento_id) && tratamiento_id.length > 0 ? tratamiento_id : null;

  // Actualizamos la cita con los datos básicos
  const { data: updatedCita, error } = await supabase.from('cita').update(updates).eq('id', citaId).select().single();
  if (error) throw error;

  let montoTotal = 0;
  let nombresTratamientos = updatedCita.tratamientos || '';

  if (tratamientosIds) {
    await supabase.from('cita_tratamiento').delete().eq('cita_id', citaId);
    const ids = tratamientosIds.map((t) => Number(t));
    const { data: tratamientosData } = await supabase.from('tratamiento').select('id, precio, nombre').in('id', ids);
    if (!tratamientosData || tratamientosData.length !== ids.length) {
      throw new Error('Tratamientos no encontrados');
    }

    montoTotal = tratamientosData.reduce((s, t) => s + Number(t.precio || 0), 0);
    nombresTratamientos = tratamientosData.map((t) => t.nombre).filter(Boolean).join(', ');

    const junctionPayload = tratamientosData.map((t) => ({
      cita_id: citaId,
      tratamiento_id: Number(t.id),
      precio: Number(t.precio || 0),
      cantidad: 1
    }));
    await supabase.from('cita_tratamiento').insert(junctionPayload);
    await supabase.from('cita').update({ tratamientos: nombresTratamientos || '' }).eq('id', citaId);
  }

  const estadoPrevio = existing.estado ? String(existing.estado) : null;
  const estadoNuevo = updatedCita.estado ? String(updatedCita.estado) : null;

  if (estadoPrevio !== 'Atendida' && (estadoNuevo === 'Atendida' || estadoNuevo?.toLowerCase() === 'atendida')) {
    const user = useAuthStore.getState().user;
    const perfilId = user?.id || null;
    const citaFecha = updatedCita.fecha || getLocalDateYYYYMMDD();

    // AQUÍ CONSTRUIMOS EL PAYLOAD FINANCIERO ASEGURADO
    const movimientoPayload = {
      tipo: 'ingreso',
      id_perfil: perfilId,
      id_doctor: Number(updatedCita.id_doctor),
      monto: montoTotal > 0 ? montoTotal : Number(updatedCita.precio || 0), 
      descripcion: detalle_pago || (nombresTratamientos ? `consulta de: ${nombresTratamientos}` : 'Consulta Odontológica'),
      fecha: citaFecha,
      sede_id: updatedCita.sede_id || null,
      metodo_pago: metodo_pago || null
    };

    await supabase.from('movimiento_finanzas').insert([movimientoPayload]);
  }

  return updatedCita;
};

export const validarEstadoCita = (estado) => {
  return estadosPermitidos.includes(String(estado));
};
