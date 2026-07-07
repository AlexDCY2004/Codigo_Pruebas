import { useState, useEffect } from 'react';

const getInitialFormData = (initialData) => ({
  nombre: initialData?.nombre || '',
  telefono: initialData?.telefono || '',
  correo: initialData?.correo || '',
  especialidad: initialData?.especialidad || '',
  estado: initialData?.estado || 'disponible'
});

function ReadRow({ label, value }) {
  return (
    <div className="field-row">
      <div className="field-label">{label}</div>
      <div className="field-value">{value ?? '-'}</div>
    </div>
  );
}

export default function DoctorModal({ isOpen, onClose, onSubmit, initialData, isLoading, readOnly = false, externalErrors = {}, externalError = '' }) {
  const [formData, setFormData] = useState(() => getInitialFormData(initialData));
  const [errors, setErrors] = useState({});
  const allErrors = { ...errors, ...externalErrors };

  useEffect(() => {
    if (isOpen) setFormData(getInitialFormData(initialData));
  }, [isOpen, initialData]);

  const validateForm = () => {
    const newErrors = {};
    if (!formData.nombre?.trim()) newErrors.nombre = 'Nombre requerido';
    else if (!/^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]+$/.test(formData.nombre.trim())) newErrors.nombre = 'Solo letras permitidas';
    if (!formData.especialidad?.trim()) newErrors.especialidad = 'Especialidad requerida';
    if (formData.telefono && !/^\d{10}$/.test(formData.telefono.trim())) newErrors.telefono = 'Debe tener 10 dígitos';
    if (formData.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.correo.trim())) newErrors.correo = 'Correo inválido';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    if (readOnly) return;
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (readOnly) return;
    if (validateForm()) onSubmit(formData);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{readOnly ? 'Ver Odontólogo' : (initialData?.id ? 'Editar Odontólogo' : 'Nuevo Odontólogo')}</h2>
          <button type="button" className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} noValidate>
          {externalError && <div className="alert alert-error" style={{ marginBottom: '0.75rem' }}>{externalError}</div>}

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
                <label htmlFor="nombre">Nombre *</label>
                <input type="text" id="nombre" name="nombre" value={formData.nombre} onChange={handleChange} placeholder="Dr. Juan Pérez" className={allErrors.nombre ? 'input-error' : ''} />
                {allErrors.nombre && <span className="error-text">{allErrors.nombre}</span>}
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="telefono">Teléfono</label>
                  <input type="tel" id="telefono" name="telefono" value={formData.telefono} onChange={handleChange} placeholder="0991234567" maxLength={10} className={allErrors.telefono ? 'input-error' : ''} />
                  {allErrors.telefono && <span className="error-text">{allErrors.telefono}</span>}
                </div>
                <div className="form-group">
                  <label htmlFor="correo">Correo</label>
                  <input type="email" id="correo" name="correo" value={formData.correo} onChange={handleChange} placeholder="correo@ejemplo.com" className={allErrors.correo ? 'input-error' : ''} />
                  {allErrors.correo && <span className="error-text">{allErrors.correo}</span>}
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="especialidad">Especialidad *</label>
                  <input type="text" id="especialidad" name="especialidad" value={formData.especialidad} onChange={handleChange} placeholder="Odontología General" className={allErrors.especialidad ? 'input-error' : ''} />
                  {allErrors.especialidad && <span className="error-text">{allErrors.especialidad}</span>}
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
            </>
          )}

          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-secondary">{readOnly ? 'Cerrar' : 'Cancelar'}</button>
            {!readOnly && <button type="submit" className="btn btn-primary" disabled={isLoading}>{isLoading ? 'Guardando...' : 'Guardar'}</button>}
          </div>
        </form>
      </div>
    </div>
  );
}
