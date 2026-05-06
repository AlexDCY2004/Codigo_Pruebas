import apiClient from './client';

export const fetchPacientes = async () => {
  try {
    const response = await apiClient.get('/api/pacientes');
    return response.data || [];
  } catch (error) {
    console.error('Error fetching pacientes:', error);
    throw error;
  }
};

export const fetchPacienteById = async (id) => {
  try {
    const response = await apiClient.get(`/api/pacientes/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching paciente:', error);
    throw error;
  }
};

export const createPaciente = async (pacienteData) => {
  try {
    const response = await apiClient.post('/api/pacientes', pacienteData);
    return response.data;
  } catch (error) {
    console.error('Error creating paciente:', error);
    throw error;
  }
};

export const updatePaciente = async (id, pacienteData) => {
  try {
    const response = await apiClient.put(`/api/pacientes/${id}`, pacienteData);
    return response.data;
  } catch (error) {
    console.error('Error updating paciente:', error);
    throw error;
  }
};

export const deletePaciente = async (id) => {
  try {
    await apiClient.delete(`/api/pacientes/${id}`);
  } catch (error) {
    console.error('Error deleting paciente:', error);
    throw error;
  }
};
