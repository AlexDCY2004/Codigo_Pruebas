import { supabase, getSedeFilter } from './supabaseClient';

export const fetchProductos = async () => {
  const filter = getSedeFilter();
  let query = supabase.from('producto').select('*');
  if (filter.sede_id !== undefined) {
    query = query.eq('sede_id', filter.sede_id);
  }
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const createProducto = async (productoData) => {
  const filter = getSedeFilter();
  const payload = {
    ...productoData,
    sede_id: productoData.sede_id ?? filter.sede_id ?? null
  };
  const { data, error } = await supabase.from('producto').insert([payload]).select();
  if (error) throw error;
  return data?.[0] || data;
};

export const updateProducto = async (id, productoData) => {
  const { data, error } = await supabase.from('producto').update(productoData).eq('id', id).select();
  if (error) throw error;
  return data?.[0] || data;
};

export const deleteProducto = async (id) => {
  const { error } = await supabase.from('producto').delete().eq('id', id);
  if (error) throw error;
};
