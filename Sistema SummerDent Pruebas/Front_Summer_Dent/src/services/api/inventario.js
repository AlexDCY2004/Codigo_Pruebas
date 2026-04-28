import apiClient from './client';

export const fetchInventarios = async () => {
  try {
    const response = await apiClient.get('/api/inventario');
    return response.data || [];
  } catch (error) {
    console.error('Error fetching inventarios:', error);
    throw error;
  }
};

export const fetchInventarioByProducto = async (idProducto) => {
  try {
    const response = await apiClient.get(`/api/inventario/producto/${idProducto}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching inventario por producto:', error);
    throw error;
  }
};

export const registrarMovimientoInventario = async (payload) => {
  try {
    const response = await apiClient.post('/api/inventario/movimiento', payload);
    return response.data;
  } catch (error) {
    console.error('Error registrando movimiento de inventario:', error);
    throw error;
  }
};

export const aumentarStockInventario = async (payload) => {
  try {
    const response = await apiClient.post('/api/inventario/aumentar', payload);
    return response.data;
  } catch (error) {
    console.error('Error aumentando stock de inventario:', error);
    throw error;
  }
};
