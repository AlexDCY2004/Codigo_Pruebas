import apiClient from './client';

export const fetchCitas = async () => {
  try {
    const response = await apiClient.get('/api/citas');
    return response.data || [];
  } catch (error) {
    console.error('Error fetching citas:', error);
    throw error;
  }
}; 

export const fetchCitaById = async (id) => {
  try {
    const response = await apiClient.get(`/api/citas/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching cita:', error);
    throw error;
  }
};

export const createCita = async (citaData) => {
  try {
    const response = await apiClient.post('/api/citas', citaData);
    return response.data;
  } catch (error) {
    console.error('Error creating cita:', error);
    throw error;
  }
};

export const updateCita = async (id, citaData) => {
  try {
    const response = await apiClient.put(`/api/citas/${id}`, citaData);
    return response.data;
  } catch (error) {
    console.error('Error updating cita:', error);
    throw error;
  }
};

export const deleteCita = async (id) => {
  try {
    await apiClient.delete(`/api/citas/${id}`);
  } catch (error) {
    console.error('Error deleting cita:', error);
    throw error;
  }
};

export const checkDisponibilidad = async ({ idDoctor, fecha, horaInicio, horaFin, exclude }) => {
  try {
    const params = { id_doctor: idDoctor, fecha, hora_inicio: horaInicio, hora_fin: horaFin };
    if (exclude) params.exclude = exclude;
    const response = await apiClient.get('/api/citas/disponibilidad', { params });
    return response.data;
  } catch (error) {
    console.error('Error checking disponibilidad:', error);
    throw error;
  }
};
