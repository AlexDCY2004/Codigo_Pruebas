import { supabase, getSedeFilter } from './supabaseClient';

export const fetchMovimientosFinanzas = async (params = {}) => {
  let query = supabase.from('movimiento_finanzas').select('id, id_perfil, id_doctor, monto, descripcion, fecha, sede_id, metodo_pago, created_at, doctor(id, nombre)');

  const filter = getSedeFilter();
  if (filter.sede_id !== undefined) {
    query = query.eq('sede_id', filter.sede_id);
  }

  if (params.desde) query = query.gte('fecha', params.desde);
  if (params.hasta) query = query.lte('fecha', params.hasta);
  if (params.metodo_pago) query = query.eq('metodo_pago', params.metodo_pago);
  if (params.id_doctor) query = query.eq('id_doctor', params.id_doctor);
  if (params.id_perfil) query = query.eq('id_perfil', params.id_perfil);

  const { data, error } = await query.order('fecha', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const createMovimientoFinanzas = async (payload) => {
  const filter = getSedeFilter();
  const dataToInsert = {
    tipo: 'ingreso',
    ...payload,
    sede_id: payload.sede_id ?? filter.sede_id ?? null
  };
  const { data, error } = await supabase.from('movimiento_finanzas').insert([dataToInsert]).select();
  if (error) throw error;
  return data?.[0] || data;
};

export const updateMovimientoFinanzas = async (id, payload) => {
  const { data, error } = await supabase.from('movimiento_finanzas').update(payload).eq('id', id).select();
  if (error) throw error;
  return data?.[0] || data;
};

export const deleteMovimientoFinanzas = async (id) => {
  const { error } = await supabase.from('movimiento_finanzas').delete().eq('id', id);
  if (error) throw error;
};
