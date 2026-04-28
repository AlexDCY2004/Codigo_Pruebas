import apiClient from './client';

export const fetchMovimientosFinanzas = async (params = {}) => {
  try {
    const response = await apiClient.get('/api/movimientos-finanzas', {
      params
    });
    return response.data || [];
  } catch (error) {
    console.error('Error fetching movimientos financieros:', error);
    throw error;
  }
};

export const fetchIngresos = async (params = {}) => {
  try {
    const response = await apiClient.get('/api/movimientos-finanzas/ingresos', {
      params
    });
    return response.data || [];
  } catch (error) {
    console.error('Error fetching ingresos:', error);
    throw error;
  }
};

export const fetchEgresos = async (params = {}) => {
  try {
    const response = await apiClient.get('/api/movimientos-finanzas/egresos', {
      params
    });
    return response.data || [];
  } catch (error) {
    console.error('Error fetching egresos:', error);
    throw error;
  }
};

export const createMovimientoFinanzas = async (payload) => {
  try {
    const response = await apiClient.post('/api/movimientos-finanzas', payload);
    return response.data;
  } catch (error) {
    console.error('Error creating movimiento financiero:', error);
    throw error;
  }
};

export const updateMovimientoFinanzas = async (id, payload) => {
  try {
    const response = await apiClient.put(`/api/movimientos-finanzas/${id}`, payload);
    return response.data;
  } catch (error) {
    console.error('Error updating movimiento financiero:', error);
    throw error;
  }
};

export const deleteMovimientoFinanzas = async (id) => {
  try {
    await apiClient.delete(`/api/movimientos-finanzas/${id}`);
  } catch (error) {
    console.error('Error deleting movimiento financiero:', error);
    throw error;
  }
};
