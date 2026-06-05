import apiClient from './client';
import { useAuthStore } from '../../store/authStore';

const getSedeActiva = () => useAuthStore.getState().sedeActiva;

export const fetchCajaMensual = async (params = {}) => {
  try {
    const sedeActiva = getSedeActiva();
    const finalParams = { ...params };
    if (sedeActiva !== null && typeof sedeActiva !== 'undefined') {
      finalParams.sede_id = sedeActiva;
    }
    const response = await apiClient.get('/api/caja-mensual', { params: finalParams });
    return response.data || null;
  } catch (error) {
    console.error('Error fetching caja mensual:', error);
    throw error;
  }
};

export const fetchCajaMensualHistory = async (params = {}) => {
  try {
    const sedeActiva = getSedeActiva();
    const finalParams = { ...params };
    if (sedeActiva !== null && typeof sedeActiva !== 'undefined') {
      finalParams.sede_id = sedeActiva;
    }
    const response = await apiClient.get('/api/caja-mensual/history', { params: finalParams });
    return response.data || [];
  } catch (error) {
    console.error('Error fetching caja mensual history:', error);
    throw error;
  }
};

export const createCajaMensual = async (payload) => {
  try {
    const sedeActiva = getSedeActiva();
    const finalPayload = { ...payload };
    if (!finalPayload.sede_id && sedeActiva !== null && typeof sedeActiva !== 'undefined') {
      finalPayload.sede_id = sedeActiva;
    }
    const response = await apiClient.post('/api/caja-mensual', finalPayload);
    return response.data;
  } catch (error) {
    console.error('Error creating caja mensual:', error);
    throw error;
  }
};

export const updateCajaMensual = async (id, payload) => {
  try {
    const response = await apiClient.put(`/api/caja-mensual/${id}`, payload);
    return response.data;
  } catch (error) {
    console.error('Error updating caja mensual:', error);
    throw error;
  }
};

export const closeCajaMensual = async (id) => {
  try {
    const response = await apiClient.post(`/api/caja-mensual/${id}/close`);
    return response.data;
  } catch (error) {
    console.error('Error closing caja mensual:', error);
    throw error;
  }
};

export default {
  fetchCajaMensual,
  fetchCajaMensualHistory,
  createCajaMensual,
  updateCajaMensual,
  closeCajaMensual
};