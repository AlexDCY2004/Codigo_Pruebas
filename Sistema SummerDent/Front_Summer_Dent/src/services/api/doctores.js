import apiClient from './client';

export const fetchDoctores = async () => {
  try {
    const response = await apiClient.get('/api/doctores');
    return response.data || [];
  } catch (error) {
    console.error('Error fetching doctores:', error);
    throw error;
  }
};

export const fetchDoctorById = async (id) => {
  try {
    const response = await apiClient.get(`/api/doctores/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching doctor:', error);
    throw error;
  }
};

export const createDoctor = async (doctorData) => {
  try {
    const response = await apiClient.post('/api/doctores', doctorData);
    return response.data;
  } catch (error) {
    console.error('Error creating doctor:', error);
    throw error;
  }
};

export const updateDoctor = async (id, doctorData) => {
  try {
    const response = await apiClient.put(`/api/doctores/${id}`, doctorData);
    return response.data;
  } catch (error) {
    console.error('Error updating doctor:', error);
    throw error;
  }
};

export const deleteDoctor = async (id) => {
  try {
    await apiClient.delete(`/api/doctores/${id}`);
  } catch (error) {
    console.error('Error deleting doctor:', error);
    throw error;
  }
};
