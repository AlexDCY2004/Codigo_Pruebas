import { useEffect, useState } from 'react';

const initialFormState = {
  nombre: '',
  telefono: '',
  correo: '',
  especialidad: '',
  estado: 'disponible'
};

const ReadRow = ({ label, value }) => (
  <div className="field-row">
    <div className="field-label">{label}</div>
    <div className="field-value">{value || '-'}</div>
  </div>
);

export default function DoctorModal({ isOpen, onClose, onSubmit, initialData, isLoading, readOnly = false, externalErrors = {}, externalError = '' }) {
  const [formData, setFormData] = useState(initialFormState);
  const [errors, setErrors] = useState({});
  const allErrors = { ...errors, ...externalErrors };

  useEffect(() => {
    let timer;

    if (initialData) {
      timer = setTimeout(() => {
        setFormData({
          nombre: initialData.nombre || '',
          telefono: initialData.telefono || '',
          correo: initialData.correo || '',
          especialidad: initialData.especialidad || '',
          estado: initialData.estado || 'disponible'
        });
        setErrors({});
      }, 0);

      return () => clearTimeout(timer);
    }

    timer = setTimeout(() => {
      setFormData(initialFormState);
      setErrors({});
    }, 0);

    return () => clearTimeout(timer);
  }, [initialData, isOpen]);

  // Merge backend field errors into local field errors.
  useEffect(() => {
    let timer;

    if (externalErrors && Object.keys(externalErrors).length > 0) {
      timer = setTimeout(() => {
        setErrors((prev) => ({ ...prev, ...externalErrors }));
      }, 0);
    }

    return () => clearTimeout(timer);
  }, [externalErrors]);

  const validateForm = () => {
    const nextErrors = {};

    if (!formData.nombre.trim()) {
      nextErrors.nombre = 'El nombre es obligatorio';
    } else if (!/^[A-Za-zÁÉÍÓÚáéíóúÑñ.\s]+$/.test(formData.nombre.trim())) {
      nextErrors.nombre = 'El nombre solo debe contener letras, espacios o puntos';
    } else if (formData.nombre.trim().length < 3) {
      nextErrors.nombre = 'El nombre debe tener al menos 3 caracteres';
    } else if (formData.nombre.trim().length > 50) {
      nextErrors.nombre = 'El nombre no puede tener más de 50 caracteres';
    }

    if (!formData.telefono.trim()) {
      nextErrors.telefono = 'El teléfono es obligatorio';
    } else if (!/^\d+$/.test(formData.telefono.trim())) {
      nextErrors.telefono = 'El teléfono solo debe contener números';
    } else if (formData.telefono.trim().length !== 10) {
      nextErrors.telefono = 'El teléfono debe tener 10 dígitos';
    } else if (/(\d)\1{3,}/.test(formData.telefono.trim())) {
      nextErrors.telefono = 'El teléfono no puede tener más de 3 dígitos iguales consecutivos';
    }

    if (!formData.correo.trim()) {
      nextErrors.correo = 'El correo es obligatorio';
    } else {
      const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRe.test(formData.correo.trim())) nextErrors.correo = 'Ingrese un correo válido';
    }

    if (!formData.especialidad.trim()) {
      nextErrors.especialidad = 'La especialidad es obligatoria';
    } else {
      // Allow letters, spaces and commas, but not only commas/spaces
      const raw = formData.especialidad.trim();
      if (!/^[A-Za-zÁÉÍÓÚáéíóúÑñ,\s]+$/.test(raw)) {
        nextErrors.especialidad = 'La especialidad solo debe contener letras y comas';
      } else if (raw.replace(/[,\s]/g, '').length === 0) {
        nextErrors.especialidad = 'La especialidad no puede contener solo comas';
      } else if (raw.length < 5) {
        nextErrors.especialidad = 'La especialidad debe tener al menos 5 caracteres';
      } else if (raw.length > 30) {
        nextErrors.especialidad = 'La especialidad no puede tener más de 30 caracteres';
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    // For telefono only allow digits and max 10
    if (name === 'telefono') {
      if (!/^\d*$/.test(value) || value.length > 10) return;
    }

    // For nombre allow letters, spaces and dots only (sanitize as user types)
    if (name === 'nombre') {
      if (value.length > 50) return;
      const sanitized = value.replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñ.\s]/g, '');
      setFormData((prev) => ({ ...prev, [name]: sanitized }));
      if (errors[name]) {
        setErrors((prev) => ({ ...prev, [name]: '' }));
      }
      return;
    }

    // For especialidad allow letters, spaces and commas only (sanitize as user types)
    if (name === 'especialidad') {
      if (value.length > 30) return;
      const sanitized = value.replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñ,\s]/g, '');
      setFormData((prev) => ({ ...prev, [name]: sanitized }));
      if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));

    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handlePaste = (e) => {
    const name = e.target?.name;
    if (name === 'telefono') {
      const paste = (e.clipboardData || window.clipboardData).getData('text');
      const digits = paste.replace(/\D/g, '').slice(0, 10);
      e.preventDefault();
      setFormData(prev => ({ ...prev, telefono: (String(prev.telefono || '') + digits).slice(0, 10) }));
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!validateForm()) return;

    onSubmit({
      nombre: formData.nombre.trim(),
      telefono: formData.telefono.trim(),
      correo: formData.correo.trim(),
      especialidad: formData.especialidad.trim(),
      estado: formData.estado
    });
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-content--doctor" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h2>{readOnly ? 'Ver Odontólogo' : initialData?.id ? 'Editar Odontólogo' : 'Nuevo Odontólogo'}</h2>
          <button type="button" className="modal-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} noValidate className={`doctor-form ${readOnly ? 'is-readonly' : ''}`}>
          {!readOnly && externalError && (
            <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
              {externalError}
            </div>
          )}
          {readOnly ? (
            <>
              <ReadRow label="Nombre:" value={formData.nombre} />
              <ReadRow label="Teléfono:" value={formData.telefono} />
              <ReadRow label="Correo:" value={formData.correo} />
              <ReadRow label="Especialidad:" value={formData.especialidad} />
              <ReadRow label="Estado:" value={formData.estado} />
            </>
          ) : (
            <>
              <div className="form-group">
                <label htmlFor="nombre">Nombre completo *</label>
                <input
                  id="nombre"
                  name="nombre"
                  type="text"
                  value={formData.nombre}
                  onChange={handleChange}
                  placeholder="Dr. Juan Pérez"
                  className={errors.nombre ? 'input-error' : ''}
                />
                {errors.nombre && <span className="error-text">{errors.nombre}</span>}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="telefono">Teléfono *</label>
                  <input
                    id="telefono"
                    name="telefono"
                    type="text"
                    value={formData.telefono}
                    onChange={handleChange}
                    onPaste={handlePaste}
                    placeholder="0991234567"
                    className={allErrors.telefono ? 'input-error' : ''}
                    maxLength={10}
                    inputMode="numeric"
                    aria-invalid={allErrors.telefono ? 'true' : 'false'}
                  />
                  {allErrors.telefono && <span className="error-text">{allErrors.telefono}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="correo">Correo *</label>
                  <input
                    id="correo"
                    name="correo"
                    type="email"
                    value={formData.correo}
                    onChange={handleChange}
                    onInvalid={(e) => e.preventDefault()}
                    placeholder="doctor@summerdent.com"
                    className={allErrors.correo ? 'input-error' : ''}
                    aria-invalid={allErrors.correo ? 'true' : 'false'}
                  />
                  {allErrors.correo && <span className="error-text">{allErrors.correo}</span>}
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="especialidad">Especialidad *</label>
                  <input
                    id="especialidad"
                    name="especialidad"
                    type="text"
                    value={formData.especialidad}
                    onChange={handleChange}
                    placeholder="Ortodoncia"
                    className={errors.especialidad ? 'input-error' : ''}
                  />
                  {errors.especialidad && <span className="error-text">{errors.especialidad}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="estado">Estado</label>
                  <select id="estado" name="estado" value={formData.estado} onChange={handleChange}>
                    <option value="disponible">Disponible</option>
                    <option value="no disponible">No disponible</option>
                    <option value="eventual">Eventual</option>
                  </select>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary btn-modal-cancel" onClick={onClose}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary btn-modal-save" disabled={isLoading}>
                  {isLoading ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </>
          )}

          {readOnly && (
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary btn-detail-close" onClick={onClose}>
                Cerrar
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
