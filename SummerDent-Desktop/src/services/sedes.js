import { supabase } from './supabaseClient';

export const fetchSedes = async () => {
  const { data, error } = await supabase.from('sede').select('*').order('nombre', { ascending: true });
  if (error) throw error;
  return data || [];
};
