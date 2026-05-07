import { useState, useEffect } from 'react';
import {
  sanitizeCedula,
  sanitizeAlpha,
  sanitizePhone,
  sanitizeEmail,
  sanitizeAddress,
  validarCedulaEcuatoriana,
  validarEmail,
  validarLongitud,
  validarFechaNoFutura
} from '../../utils/sanitize';

const getInitialFormData = (initialData) => ({
  id_cedula: initialData?.id_cedula || '',
  nombre: initialData?.nombre || '',
  apellido: initialData?.apellido || '',
  fecha_nacimiento: initialData?.fecha_nacimiento || '',
  telefono: initialData?.telefono || '',
  correo: initialData?.correo || '',
  direccion: initialData?.direccion || ''
});

function ReadRow({ label, value }) {
  return (
    <div className="field-row">
      <div className="field-label">{label}</div>
      <div className="field-value">{value ?? '-'}</div>
    </div>
  );
}

export default function PacienteModal({ isOpen, onClose, onSubmit, initialData, isLoading, readOnly = false, isEditing = false, externalErrors = {} }) {
  const [formData, setFormData] = useState(() => getInitialFormData(initialData));

  // Reset when modal opens/closes or initialData changes
  useEffect(() => {
    setFormData(getInitialFormData(initialData));
    setErrors({});
  }, [initialData, isOpen]);

  // Merge external/server-side field errors into local errors
  useEffect(() => {
    if (externalErrors && Object.keys(externalErrors).length > 0) {
      setErrors(prev => ({ ...prev, ...externalErrors }));
    }
  }, [externalErrors]);

  const [errors, setErrors] = useState({});

  const validateForm = () => {
    const newErrors = {};
    
    // Cédula: validación ecuatoriana completa
    const cedulaError = validarCedulaEcuatoriana(formData.id_cedula);
    if (cedulaError) newErrors.id_cedula = cedulaError;

    // Nombre
    const nombreError = validarLongitud(formData.nombre, 2, 50, 'El nombre');
    if (!formData.nombre?.trim()) newErrors.nombre = 'Nombre requerido';
    else if (nombreError) newErrors.nombre = nombreError;

    // Apellido
    const apellidoError = validarLongitud(formData.apellido, 2, 50, 'El apellido');
    if (!formData.apellido?.trim()) newErrors.apellido = 'Apellido requerido';
    else if (apellidoError) newErrors.apellido = apellidoError;

    // Fecha de nacimiento
    if (!formData.fecha_nacimiento) {
      newErrors.fecha_nacimiento = 'Fecha de nacimiento requerida';
    } else {
      const fechaError = validarFechaNoFutura(formData.fecha_nacimiento);
      if (fechaError) newErrors.fecha_nacimiento = fechaError;
    }

    // Teléfono (opcional, pero si se ingresa debe ser 10 dígitos)
    if (formData.telefono?.trim()) {
      if (!/^\d{10}$/.test(formData.telefono.trim())) {
        newErrors.telefono = 'El teléfono debe tener exactamente 10 dígitos';
      }
    }

    // Correo (opcional, pero si se ingresa debe ser válido)
    if (formData.correo?.trim()) {
      const correoError = validarEmail(formData.correo);
      if (correoError) newErrors.correo = correoError;
    }

    // Dirección (opcional, solo limitar longitud)
    if (formData.direccion && formData.direccion.length > 255) {
      newErrors.direccion = 'La dirección no puede superar 255 caracteres';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    if (readOnly) return;
    const { name, value } = e.target;

    let sanitized = value;
    switch (name) {
      case 'id_cedula':
        sanitized = sanitizeCedula(value);
        break;
      case 'nombre':
      case 'apellido':
        sanitized = sanitizeAlpha(value, 50);
        break;
      case 'telefono':
        sanitized = sanitizePhone(value);
        break;
      case 'correo':
        sanitized = sanitizeEmail(value, 100);
        break;
      case 'direccion':
        sanitized = sanitizeAddress(value, 255);
        break;
      default:
        break;
    }

    setFormData(prev => ({
      ...prev,
      [name]: sanitized
    }));
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (readOnly) return; // prevent submit in view mode
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-content--paciente" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{readOnly ? 'Ver Paciente' : (initialData?.id_cedula ? 'Editar Paciente' : 'Nuevo Paciente')}</h2>
          <button type="button" className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className={`patient-form ${readOnly ? 'is-readonly' : ''}`}>
          {readOnly ? (
            <>
              <ReadRow label="Cédula:" value={formData.id_cedula} />
              <ReadRow label="Nombre:" value={formData.nombre} />
              <ReadRow label="Apellido:" value={formData.apellido} />
            </>
          ) : (
            <>
              <div className="form-group">
                <label htmlFor="id_cedula">Cédula *</label>
                {isEditing ? (
                  <input
                    type="text"
                    id="id_cedula"
                    name="id_cedula"
                    value={formData.id_cedula}
                    onChange={handleChange}
                    placeholder="1234567890"
                    className={errors.id_cedula ? 'input-error' : ''}
                    disabled
                  />
                ) : (
                  <input
                    type="text"
                    id="id_cedula"
                    name="id_cedula"
                    value={formData.id_cedula}
                    onChange={handleChange}
                    placeholder="1234567890"
                    className={errors.id_cedula ? 'input-error' : ''}
                  />
                )}
                {errors.id_cedula && <span className="error-text">{errors.id_cedula}</span>}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="nombre">Nombre *</label>
                  <input
                    type="text"
                    id="nombre"
                    name="nombre"
                    value={formData.nombre}
                    onChange={handleChange}
                    placeholder="Juan"
                    className={errors.nombre ? 'input-error' : ''}
                  />
                  {errors.nombre && <span className="error-text">{errors.nombre}</span>}
                </div>
                <div className="form-group">
                  <label htmlFor="apellido">Apellido *</label>
                  <input
                    type="text"
                    id="apellido"
                    name="apellido"
                    value={formData.apellido}
                    onChange={handleChange}
                    placeholder="Pérez"
                    className={errors.apellido ? 'input-error' : ''}
                  />
                  {errors.apellido && <span className="error-text">{errors.apellido}</span>}
                </div>
              </div>
            </>
          )}

          {readOnly ? (
            <>
              <ReadRow label="Fecha de Nacimiento:" value={formData.fecha_nacimiento} />
              <ReadRow label="Teléfono:" value={formData.telefono} />
              <ReadRow label="Correo:" value={formData.correo} />
              <ReadRow label="Dirección:" value={formData.direccion} />
            </>
          ) : (
            <>
              <div className="form-group">
                <label htmlFor="fecha_nacimiento">Fecha de Nacimiento *</label>
                <input
                  type="date"
                  id="fecha_nacimiento"
                  name="fecha_nacimiento"
                  value={formData.fecha_nacimiento}
                  onChange={handleChange}
                  className={errors.fecha_nacimiento ? 'input-error' : ''}
                />
                {errors.fecha_nacimiento && <span className="error-text">{errors.fecha_nacimiento}</span>}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="telefono">Teléfono</label>
                  <input
                    type="tel"
                    id="telefono"
                    name="telefono"
                    value={formData.telefono}
                    onChange={handleChange}
                    placeholder="0991234567"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="correo">Correo</label>
                  <input
                    type="email"
                    id="correo"
                    name="correo"
                    value={formData.correo}
                    onChange={handleChange}
                    placeholder="email@example.com"
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="direccion">Dirección</label>
                <input
                  type="text"
                  id="direccion"
                  name="direccion"
                  value={formData.direccion}
                  onChange={handleChange}
                  placeholder="Av. Principal 123"
                />
              </div>
            </>
          )}

          <div className="modal-footer">
            <button type="button" onClick={onClose} className={readOnly ? 'btn btn-secondary btn-detail-close' : 'btn btn-secondary btn-modal-cancel'}>
              {readOnly ? 'Cerrar' : 'Cancelar'}
            </button>
            {!readOnly && (
              <button type="submit" className="btn btn-primary btn-modal-save" disabled={isLoading}>
                {isLoading ? 'Guardando...' : 'Guardar'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
