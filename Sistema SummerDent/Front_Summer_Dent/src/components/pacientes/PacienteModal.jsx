import { useState} from 'react';

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

const computeAgeFromDate = (fecha) => {
  if (!fecha) return '-';
  try {
    const d = new Date(fecha);
    if (Number.isNaN(d.getTime())) return '-';
    const now = new Date();
    let age = now.getFullYear() - d.getFullYear();
    const m = now.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
    return Number.isFinite(age) && age >= 0 ? String(age) : '-';
  } catch {
    return '-';
  }
};

export default function PacienteModal({ isOpen, onClose, onSubmit, initialData, isLoading, readOnly = false, isEditing = false, externalErrors = {}, onClearExternalError }) {
  const [formData, setFormData] = useState(() => getInitialFormData(initialData));
  const [errors, setErrors] = useState({});
  const allErrors = { ...errors, ...externalErrors };
  
  const validateForm = () => {
    const newErrors = {};

    if (!formData.id_cedula?.trim()) {
      newErrors.id_cedula = 'Cédula requerida';
    } else if (formData.id_cedula.trim().length !== 10) {
      newErrors.id_cedula = 'La cédula debe tener 10 dígitos';
    }

    if (!formData.nombre?.trim()) newErrors.nombre = 'Nombre requerido';
    if (!formData.apellido?.trim()) newErrors.apellido = 'Apellido requerido';

    // Fecha de nacimiento: requerida y al menos 2 años, máximo 60
    if (!formData.fecha_nacimiento) {
      newErrors.fecha_nacimiento = 'Fecha de nacimiento requerida';
    } else {
      const d = new Date(formData.fecha_nacimiento);
      if (Number.isNaN(d.getTime())) {
        newErrors.fecha_nacimiento = 'Fecha de nacimiento inválida';
      } else {
        const now = new Date();
        let age = now.getFullYear() - d.getFullYear();
        const m = now.getMonth() - d.getMonth();
        if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
        if (age < 2) newErrors.fecha_nacimiento = 'El paciente debe tener al menos 2 años. No se admite fechas futuras';
        else if (age > 60) newErrors.fecha_nacimiento = 'La edad debe ser menor o igual a 60 años';
      }
    }

    // Correo: si existe, debe ser válido (mostrar error en UI en vez de tooltip nativo)
    if (formData.correo) {
      const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRe.test(formData.correo)) newErrors.correo = 'Ingrese un correo válido.';
    }

    // Teléfono: opcional, pero si está presente debe tener 10 dígitos y no permitir 4 o más dígitos iguales consecutivos
    if (formData.telefono) {
      const tel = String(formData.telefono).trim();
      if (!/^\d{10}$/.test(tel)) newErrors.telefono = 'El teléfono debe contener solo 10 dígitos';
      else if (/(\d)\1{3,}/.test(tel)) newErrors.telefono = 'El teléfono no puede tener más de 3 dígitos iguales consecutivos';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    if (readOnly) return;
    const { name, value } = e.target;
    
    if (name === 'id_cedula' || name === 'telefono') {
      if (!/^\d*$/.test(value) || value.length > 10) return; // solo números, máx 10
    }
    
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
    if (externalErrors[name]) {
      onClearExternalError(name);
    }
  };

  const handlePaste = (e) => {
    if (readOnly) return;
    const name = e.target?.name;
    if (name === 'id_cedula' || name === 'telefono') {
      const paste = (e.clipboardData || window.clipboardData).getData('text');
      const digits = paste.replace(/\D/g, '').slice(0, 10);
      e.preventDefault();
      setFormData(prev => ({ ...prev, [name]: (String(prev[name] || '') + digits).slice(0, 10) }));
      if (externalErrors[name]) onClearExternalError(name);
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
        <form onSubmit={handleSubmit} noValidate className={`patient-form ${readOnly ? 'is-readonly' : ''}`}>
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
                    className={allErrors.id_cedula ? 'input-error' : ''}
                    disabled
                  />
                ) : (
                  <input
                    type="text"
                    id="id_cedula"
                    name="id_cedula"
                    value={formData.id_cedula}
                    onChange={handleChange}
                    onPaste={handlePaste}
                    placeholder="1234567890"
                    className={allErrors.id_cedula ? 'input-error' : ''}
                    maxLength={10}
                    inputMode="numeric"
                    aria-invalid={allErrors.id_cedula ? 'true' : 'false'}
                  />
                )}
                {allErrors.id_cedula && <span className="error-text">{allErrors.id_cedula}</span>}
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
                    className={allErrors.nombre ? 'input-error' : ''}
                  />
                  {allErrors.nombre && <span className="error-text">{allErrors.nombre}</span>}
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
                    className={allErrors.apellido ? 'input-error' : ''}
                  />
                  {allErrors.apellido && <span className="error-text">{allErrors.apellido}</span>}
                </div>
              </div>
            </>
          )}

          {readOnly ? (
            <>
              <ReadRow label="Fecha de Nacimiento:" value={formData.fecha_nacimiento} />
              <ReadRow label="Edad:" value={(() => { const a = computeAgeFromDate(formData.fecha_nacimiento); return a === '-' ? a : `${a} años`; })()} />
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
                  className={allErrors.fecha_nacimiento ? 'input-error' : ''}
                />
                {allErrors.fecha_nacimiento && <span className="error-text">{allErrors.fecha_nacimiento}</span>}
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
                  <label htmlFor="correo">Correo</label>
                  <input
                    type="email"
                    id="correo"
                    name="correo"
                    value={formData.correo}
                    onChange={handleChange}
                    onInvalid={(e) => e.preventDefault()}
                    placeholder="email@example.com"
                    className={allErrors.correo ? 'input-error' : ''}
                    aria-invalid={allErrors.correo ? 'true' : 'false'}
                  />
                  {allErrors.correo && <span className="error-text">{allErrors.correo}</span>}
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
                  className={allErrors.direccion ? 'input-error' : ''}
                />
                {allErrors.direccion && <span className="error-text">{allErrors.direccion}</span>}
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
