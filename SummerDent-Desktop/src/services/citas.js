import { supabase, getSedeFilter } from './supabaseClient';

export const fetchCitas = async () => {
  const filter = getSedeFilter();
  let query = supabase.from('cita').select('*');
  if (filter.sede_id !== undefined) {
    query = query.eq('sede_id', filter.sede_id);
  }
  const { data, error } = await query.order('fecha', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const fetchCitaById = async (id) => {
  const { data, error } = await supabase.from('cita').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
};

export const createCita = async (citaData) => {
  const filter = getSedeFilter();
  const payload = {
    ...citaData,
    sede_id: citaData.sede_id ?? filter.sede_id ?? null
  };

  const { data, error } = await supabase.from('cita').insert([payload]).select();
  if (error) throw error;
  return data?.[0] || data;
};

export const updateCita = async (id, citaData) => {
  const { data, error } = await supabase.from('cita').update(citaData).eq('id', id).select();
  if (error) throw error;
  return data?.[0] || data;
};

export const deleteCita = async (id) => {
  const { error } = await supabase.from('cita').delete().eq('id', id);
  if (error) throw error;
};
