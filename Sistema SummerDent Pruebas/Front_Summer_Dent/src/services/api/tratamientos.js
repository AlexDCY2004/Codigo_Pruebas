import apiClient from './client';

export const fetchTratamientos = async () => {
  try {
    const response = await apiClient.get('/api/tratamientos');
    return response.data || [];
  } catch (error) {
    console.error('Error fetching tratamientos:', error);
    throw error;
  }
};

export const fetchTratamientoById = async (id) => {
  try {
    const response = await apiClient.get(`/api/tratamientos/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching tratamiento:', error);
    throw error;
  }
};

export const createTratamiento = async (tratamientoData) => {
  try {
    const response = await apiClient.post('/api/tratamientos', tratamientoData);
    return response.data;
  } catch (error) {
    console.error('Error creating tratamiento:', error);
    throw error;
  }
};

export const updateTratamiento = async (id, tratamientoData) => {
  try {
    const response = await apiClient.put(`/api/tratamientos/${id}`, tratamientoData);
    return response.data;
  } catch (error) {
    console.error('Error updating tratamiento:', error);
    throw error;
  }
};

export const deleteTratamiento = async (id) => {
  try {
    await apiClient.delete(`/api/tratamientos/${id}`);
  } catch (error) {
    console.error('Error deleting tratamiento:', error);
    throw error;
  }
};
