import apiClient from './client';

export const fetchProductos = async () => {
  try {
    const response = await apiClient.get('/api/productos');
    return response.data || [];
  } catch (error) {
    console.error('Error fetching productos:', error);
    throw error;
  }
};

export const createProducto = async (payload) => {
  try {
    const response = await apiClient.post('/api/productos', payload);
    return response.data;
  } catch (error) {
    console.error('Error creating producto:', error);
    throw error;
  }
};

export const updateProducto = async (id, payload) => {
  try {
    const response = await apiClient.put(`/api/productos/${id}`, payload);
    return response.data;
  } catch (error) {
    console.error('Error updating producto:', error);
    throw error;
  }
};

export const deleteProducto = async (id) => {
  try {
    await apiClient.delete(`/api/productos/${id}`);
  } catch (error) {
    console.error('Error deleting producto:', error);
    throw error;
  }
};
