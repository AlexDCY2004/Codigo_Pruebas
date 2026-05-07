// ============================================================================
// sanitize.js — Funciones centralizadas de sanitización y validación
// ============================================================================
// Estas funciones se usan en los handlers `onChange` para PREVENIR que el
// usuario ingrese datos no deseados, y en `validateForm` / `onSubmit` para
// VERIFICAR el formato antes de enviar al backend.
// ============================================================================

// ── Patrón peligroso (SQL injection / XSS) ──────────────────────────────────
const DANGEROUS_CHARS = /['"`;\\<>{}|]/g;

// ── Sanitización en onChange ─────────────────────────────────────────────────

/**
 * Texto genérico: elimina caracteres peligrosos y limita longitud.
 * Permite letras (con acentos), números, espacios, puntos, comas, guiones y paréntesis.
 */
export const sanitizeText = (value, maxLength = 255) => {
  return String(value || '')
    .replace(DANGEROUS_CHARS, '')
    .replace(/--+/g, '-')
    .slice(0, maxLength);
};

/**
 * Solo dígitos (0-9), con longitud máxima.
 */
export const sanitizeDigits = (value, maxLength = 10) => {
  return String(value || '')
    .replace(/\D/g, '')
    .slice(0, maxLength);
};

/**
 * Solo letras (con acentos y ñ) y espacios.
 */
export const sanitizeAlpha = (value, maxLength = 100) => {
  return String(value || '')
    .replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñÜü\s]/g, '')
    .slice(0, maxLength);
};

/**
 * Email: permite letras, números, @, ., _, +, -.
 */
export const sanitizeEmail = (value, maxLength = 100) => {
  return String(value || '')
    .replace(/[^A-Za-z0-9@._+\-]/g, '')
    .slice(0, maxLength);
};

/**
 * Teléfono: solo dígitos, máximo 10.
 */
export const sanitizePhone = (value) => sanitizeDigits(value, 10);

/**
 * Cédula: solo dígitos, máximo 10.
 */
export const sanitizeCedula = (value) => sanitizeDigits(value, 10);

/**
 * Número decimal: permite dígitos y un solo punto decimal.
 * Útil para precios y montos.
 */
export const sanitizeDecimal = (value, maxLength = 12) => {
  let clean = String(value || '').replace(/[^0-9.]/g, '');

  // Permitir solo un punto decimal
  const parts = clean.split('.');
  if (parts.length > 2) {
    clean = parts[0] + '.' + parts.slice(1).join('');
  }

  return clean.slice(0, maxLength);
};

/**
 * Dirección: permite letras, números, espacios, puntos, comas, guiones, # y /.
 */
export const sanitizeAddress = (value, maxLength = 255) => {
  return String(value || '')
    .replace(/['"`;\\<>{}|]/g, '')
    .replace(/--+/g, '-')
    .slice(0, maxLength);
};

// ── Validaciones onSubmit ───────────────────────────────────────────────────

/**
 * Valida cédula ecuatoriana usando el algoritmo de módulo 10.
 * Retorna un string con el error, o vacío si es válida.
 */
export const validarCedulaEcuatoriana = (cedula) => {
  const clean = String(cedula || '').trim();

  if (!clean) return 'La cédula es obligatoria';
  if (!/^\d{10}$/.test(clean)) return 'La cédula debe tener exactamente 10 dígitos';

  const provincia = parseInt(clean.substring(0, 2), 10);
  if (provincia < 1 || provincia > 24) {
    return 'Los dos primeros dígitos de la cédula no corresponden a una provincia válida';
  }

  const tercerDigito = parseInt(clean[2], 10);
  if (tercerDigito >= 6) {
    return 'El tercer dígito de la cédula no es válido para persona natural';
  }

  // Algoritmo módulo 10
  const coeficientes = [2, 1, 2, 1, 2, 1, 2, 1, 2];
  let suma = 0;

  for (let i = 0; i < 9; i++) {
    let resultado = parseInt(clean[i], 10) * coeficientes[i];
    if (resultado >= 10) resultado -= 9;
    suma += resultado;
  }

  const residuo = suma % 10;
  const digitoVerificadorCalculado = residuo === 0 ? 0 : 10 - residuo;
  const digitoVerificadorReal = parseInt(clean[9], 10);

  if (digitoVerificadorCalculado !== digitoVerificadorReal) {
    return 'La cédula ingresada no es válida';
  }

  return '';
};

/**
 * Valida formato de email básico.
 */
export const validarEmail = (email) => {
  if (!email || !email.trim()) return '';
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!re.test(email.trim())) return 'El formato del correo no es válido';
  return '';
};

/**
 * Valida que un texto tenga al menos `min` y máximo `max` caracteres.
 */
export const validarLongitud = (value, min, max, label = 'El campo') => {
  const trimmed = String(value || '').trim();
  if (min > 0 && trimmed.length < min) return `${label} debe tener al menos ${min} caracteres`;
  if (max && trimmed.length > max) return `${label} no puede superar ${max} caracteres`;
  return '';
};

/**
 * Valida que una fecha no sea futura.
 */
export const validarFechaNoFutura = (fecha) => {
  if (!fecha) return '';
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const today = `${y}-${m}-${day}`;
  if (String(fecha) > today) return 'La fecha no puede ser futura';
  return '';
};
