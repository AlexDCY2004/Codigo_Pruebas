import { supabase, getSedeFilter } from './supabaseClient';

export const fetchPacientes = async () => {
  const filter = getSedeFilter();
  let query = supabase.from('paciente').select('*');
  if (filter.sede_id !== undefined) {
    query = query.eq('sede_id', filter.sede_id);
  }
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const fetchPacienteById = async (id) => {
  const { data, error } = await supabase.from('paciente').select('*').eq('id_cedula', id).single();
  if (error) throw error;
  return data;
};

export const createPaciente = async (pacienteData) => {
  const filter = getSedeFilter();
  const payload = {
    ...pacienteData,
    sede_id: pacienteData.sede_id ?? filter.sede_id ?? null
  };
  const { data, error } = await supabase.from('paciente').insert([payload]).select();
  if (error) throw error;
  return data?.[0] || data;
};

export const updatePaciente = async (id, pacienteData) => {
  const { data, error } = await supabase.from('paciente').update(pacienteData).eq('id_cedula', id).select();
  if (error) throw error;
  return data?.[0] || data;
};

export const deletePaciente = async (id) => {
  const { error } = await supabase.from('paciente').delete().eq('id_cedula', id);
  if (error) throw error;
};
