import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFrom = vi.hoisted(() => vi.fn());

vi.mock('../../services/supabaseClient', () => ({
  supabase: { from: mockFrom },
  getSedeFilter: () => ({ sede_id: 1 })
}));

const mockData = [
  { id_cedula: '1234567890', nombre: 'Juan', apellido: 'Pérez', telefono: '0999999999', sede_id: 1, created_at: '2026-01-01' },
  { id_cedula: '0987654321', nombre: 'María', apellido: 'Gómez', telefono: '0988888888', sede_id: 1, created_at: '2026-01-02' }
];

describe('pacientes service', () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  describe('fetchPacientes', () => {
    it('retorna lista de pacientes', async () => {
      const { fetchPacientes } = await import('../../services/pacientes');
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockData, error: null })
      };
      mockFrom.mockReturnValue(mockQuery);

      const result = await fetchPacientes();
      expect(result).toEqual(mockData);
      expect(mockFrom).toHaveBeenCalledWith('paciente');
    });

    it('lanza error si hay error en la consulta', async () => {
      const { fetchPacientes } = await import('../../services/pacientes');
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error: new Error('DB error') })
      };
      mockFrom.mockReturnValue(mockQuery);

      await expect(fetchPacientes()).rejects.toThrow('DB error');
    });
  });

  describe('fetchPacienteById', () => {
    it('retorna paciente por cédula', async () => {
      const { fetchPacienteById } = await import('../../services/pacientes');
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockData[0], error: null })
      };
      mockFrom.mockReturnValue(mockQuery);

      const result = await fetchPacienteById('1234567890');
      expect(result).toEqual(mockData[0]);
    });
  });

  describe('createPaciente', () => {
    it('crea paciente y retorna el dato', async () => {
      const { createPaciente } = await import('../../services/pacientes');
      const newPaciente = { id_cedula: '1111111111', nombre: 'Nuevo', apellido: 'Paciente' };
      const mockQuery = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue({ data: [newPaciente], error: null })
      };
      mockFrom.mockReturnValue(mockQuery);

      const result = await createPaciente(newPaciente);
      expect(result).toEqual(newPaciente);
    });
  });

  describe('updatePaciente', () => {
    it('actualiza paciente y retorna datos actualizados', async () => {
      const { updatePaciente } = await import('../../services/pacientes');
      const updated = { nombre: 'Juan Updated' };
      const mockQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue({ data: [{ ...mockData[0], ...updated }], error: null })
      };
      mockFrom.mockReturnValue(mockQuery);

      const result = await updatePaciente('1234567890', updated);
      expect(result.nombre).toBe('Juan Updated');
    });
  });

  describe('deletePaciente', () => {
    it('elimina paciente sin error', async () => {
      const { deletePaciente } = await import('../../services/pacientes');
      const mockQuery = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null })
      };
      mockFrom.mockReturnValue(mockQuery);

      await expect(deletePaciente('1234567890')).resolves.toBeUndefined();
    });
  });

  describe('checkCedulaExists', () => {
    it('retorna true si la cédula existe', async () => {
      const { checkCedulaExists } = await import('../../services/pacientes');
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { id_cedula: '1234567890' }, error: null })
      };
      mockFrom.mockReturnValue(mockQuery);

      const result = await checkCedulaExists('1234567890');
      expect(result).toBe(true);
    });

    it('retorna false si la cédula no existe', async () => {
      const { checkCedulaExists } = await import('../../services/pacientes');
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
      };
      mockFrom.mockReturnValue(mockQuery);

      const result = await checkCedulaExists('9999999999');
      expect(result).toBe(false);
    });
  });
});