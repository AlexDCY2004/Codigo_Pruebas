import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getCitaDateWindow,
  esFechaCitaDentroDeVentana,
  validarEstadoCita,
  calcularPrecioTratamientos,
  getTratamientosNombres
} from '../../services/businessLogic';

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn()
  }
}));

import { supabase } from '../../lib/supabase';

describe('businessLogic - funciones puras', () => {
  describe('getCitaDateWindow', () => {
    it('retorna minDate y maxDate en formato YYYY-MM-DD', () => {
      const { minDate, maxDate } = getCitaDateWindow();
      expect(minDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(maxDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('minDate es anterior a maxDate', () => {
      const { minDate, maxDate } = getCitaDateWindow();
      expect(minDate < maxDate).toBe(true);
    });
  });

  describe('esFechaCitaDentroDeVentana', () => {
    it('retorna true para fecha dentro del rango', () => {
      const { minDate, maxDate } = getCitaDateWindow();
      expect(esFechaCitaDentroDeVentana(minDate)).toBe(true);
      expect(esFechaCitaDentroDeVentana(maxDate)).toBe(true);
    });

    it('retorna false para fecha null', () => {
      expect(esFechaCitaDentroDeVentana(null)).toBe(false);
    });

    it('retorna false para fecha undefined', () => {
      expect(esFechaCitaDentroDeVentana(undefined)).toBe(false);
    });
  });

  describe('validarEstadoCita', () => {
    it('acepta estados válidos', () => {
      expect(validarEstadoCita('agendada')).toBe(true);
      expect(validarEstadoCita('confirmada')).toBe(true);
      expect(validarEstadoCita('Atendida')).toBe(true);
      expect(validarEstadoCita('cancelada')).toBe(true);
    });

    it('rechaza estados inválidos', () => {
      expect(validarEstadoCita('pendiente')).toBe(false);
      expect(validarEstadoCita('')).toBe(false);
      expect(validarEstadoCita('finalizada')).toBe(false);
    });
  });

  describe('calcularPrecioTratamientos', () => {
    beforeEach(() => {
      supabase.from.mockReset();
    });

    it('retorna 0 si no hay tratamientos', async () => {
      const result = await calcularPrecioTratamientos([]);
      expect(result).toBe(0);
    });

    it('retorna 0 si tratamientosIds es null', async () => {
      const result = await calcularPrecioTratamientos(null);
      expect(result).toBe(0);
    });

    it('calcula suma de precios correctamente', async () => {
      const mockSelect = vi.fn().mockReturnThis();
      const mockIn = vi.fn().mockReturnThis();
      const mockThen = vi.fn((resolve) =>
        Promise.resolve(resolve({
          data: [
            { id: 1, precio: 50 },
            { id: 2, precio: 30 }
          ],
          error: null
        }))
      );

      supabase.from.mockReturnValue({ select: mockSelect, in: mockIn, then: mockThen });
      mockSelect.mockReturnValue({ in: mockIn, then: mockThen });

      const result = await calcularPrecioTratamientos([1, 2]);
      expect(result).toBe(80);
    });

    it('lanza error si faltan tratamientos', async () => {
      const mockSelect = vi.fn().mockReturnThis();
      const mockIn = vi.fn().mockReturnThis();
      const mockThen = vi.fn((resolve) =>
        Promise.resolve(resolve({ data: [{ id: 1, precio: 50 }], error: null }))
      );

      supabase.from.mockReturnValue({ select: mockSelect, in: mockIn, then: mockThen });
      mockSelect.mockReturnValue({ in: mockIn, then: mockThen });

      await expect(calcularPrecioTratamientos([1, 99])).rejects.toThrow('Tratamientos no encontrados');
    });
  });

  describe('getTratamientosNombres', () => {
    it('retorna string vacío si no hay tratamientos', async () => {
      const result = await getTratamientosNombres([]);
      expect(result).toBe('');
    });

    it('retorna nombres concatenados', async () => {
      const mockSelect = vi.fn().mockReturnThis();
      const mockIn = vi.fn().mockReturnThis();
      const mockThen = vi.fn((resolve) =>
        Promise.resolve(resolve({
          data: [
            { nombre: 'Limpieza Dental' },
            { nombre: 'Consulta General' }
          ],
          error: null
        }))
      );

      supabase.from.mockReturnValue({ select: mockSelect, in: mockIn, then: mockThen });
      mockSelect.mockReturnValue({ in: mockIn, then: mockThen });

      const result = await getTratamientosNombres([1, 2]);
      expect(result).toBe('Limpieza Dental, Consulta General');
    });
  });
});
