import { supabase, getSedeFilter } from './supabaseClient';

export const fetchTratamientos = async () => {
  const filter = getSedeFilter();
  let query = supabase.from('tratamiento').select('*');
  if (filter.sede_id !== undefined) {
    query = query.eq('sede_id', filter.sede_id);
  }
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const fetchTratamientoById = async (id) => {
  const { data, error } = await supabase.from('tratamiento').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
};

export const createTratamiento = async (tratamientoData) => {
  const filter = getSedeFilter();
  const payload = {
    ...tratamientoData,
    sede_id: tratamientoData.sede_id ?? filter.sede_id ?? null
  };
  const { data, error } = await supabase.from('tratamiento').insert([payload]).select();
  if (error) throw error;
  return data?.[0] || data;
};

export const updateTratamiento = async (id, tratamientoData) => {
  const { data, error } = await supabase.from('tratamiento').update(tratamientoData).eq('id', id).select();
  if (error) throw error;
  return data?.[0] || data;
};

export const deleteTratamiento = async (id) => {
  const { error } = await supabase.from('tratamiento').delete().eq('id', id);
  if (error) throw error;
};
