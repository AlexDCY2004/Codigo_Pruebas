import { supabase, getSedeFilter } from './supabaseClient';

export const fetchDoctores = async () => {
  const filter = getSedeFilter();
  let query = supabase.from('doctor').select('*');
  if (filter.sede_id !== undefined) {
    query = query.eq('sede_id', filter.sede_id);
  }
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const fetchDoctorById = async (id) => {
  const { data, error } = await supabase.from('doctor').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
};

export const createDoctor = async (doctorData) => {
  const filter = getSedeFilter();
  const payload = {
    ...doctorData,
    sede_id: doctorData.sede_id ?? filter.sede_id ?? null
  };
  const { data, error } = await supabase.from('doctor').insert([payload]).select();
  if (error) throw error;
  return data?.[0] || data;
};

export const updateDoctor = async (id, doctorData) => {
  const { data, error } = await supabase.from('doctor').update(doctorData).eq('id', id).select();
  if (error) throw error;
  return data?.[0] || data;
};

export const deleteDoctor = async (id) => {
  const { error } = await supabase.from('doctor').delete().eq('id', id);
  if (error) throw error;
};
