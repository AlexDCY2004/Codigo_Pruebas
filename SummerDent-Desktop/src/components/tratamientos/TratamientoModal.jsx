import { useState, useEffect } from 'react';

const AREAS = [
  'Odontologia General', 'Ortodoncia', 'Estetica Dental', 'Endodoncia',
  'Cirugia Oral', 'Periodoncia', 'Rehabilitacion Oral', 'Odontopediatria'
];

const getInitialFormData = (initialData) => ({
  area: initialData?.area || '',
  nombre: initialData?.nombre || '',
  precio: initialData?.precio ?? '',
  descripcion: initialData?.descripcion || ''
});

function ReadRow({ label, value }) {
  return (
    <div className="field-row">
      <div className="field-label">{label}</div>
      <div className="field-value">{value ?? '-'}</div>
    </div>
  );
}

export default function TratamientoModal({ isOpen, onClose, onSubmit, initialData, isLoading, readOnly = false, serverError = '', clearServerError, serverFieldErrors = {}, clearServerFieldErrors }) {
  const [formData, setFormData] = useState(() => getInitialFormData(initialData));
  const [errors, setErrors] = useState({});
  const allErrors = { ...errors, ...serverFieldErrors };

  useEffect(() => {
    if (isOpen) setFormData(getInitialFormData(initialData));
  }, [isOpen, initialData]);

  const validateForm = () => {
    const newErrors = {};
    if (!formData.area) newErrors.area = 'Área requerida';
    if (!formData.nombre?.trim()) newErrors.nombre = 'Nombre requerido';
    else if (formData.nombre.trim().length < 5) newErrors.nombre = 'Mínimo 5 caracteres';
    else if (formData.nombre.trim().length > 64) newErrors.nombre = 'Máximo 64 caracteres';
    if (formData.precio === '' || Number(formData.precio) <= 0) newErrors.precio = 'Precio debe ser mayor a 0';
    else if (Number(formData.precio) > 9999.99) newErrors.precio = 'Precio máximo $9,999.99';
    if (formData.descripcion && formData.descripcion.length > 300) newErrors.descripcion = 'Máximo 300 caracteres';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    if (readOnly) return;
    const { name, value } = e.target;
    if (name === 'precio') {
      if (value === '' || /^\d{1,4}(\.\d{0,2})?$/.test(value)) {
        setFormData(prev => ({ ...prev, precio: value }));
      }
      return;
    }
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
    if (serverFieldErrors[name] && clearServerFieldErrors) clearServerFieldErrors(name);
    if (serverError && clearServerError) clearServerError();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (readOnly) return;
    if (validateForm()) {
      onSubmit({
        ...formData,
        precio: Number(formData.precio)
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{readOnly ? 'Ver Tratamiento' : (initialData?.id ? 'Editar Tratamiento' : 'Nuevo Tratamiento')}</h2>
          <button type="button" className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} noValidate className={`tratamiento-form${readOnly ? ' tratamiento-form--readonly' : ''}`}>
          {serverError && <div className="alert alert-error" style={{ marginBottom: '0.75rem' }}>{serverError}</div>}

          {readOnly ? (
            <div className="tratamiento-read-grid">
              <ReadRow label="Área:" value={formData.area} />
              <ReadRow label="Nombre:" value={formData.nombre} />
              <ReadRow label="Precio:" value={formData.precio ? `$${Number(formData.precio).toFixed(2)}` : '-'} />
              <ReadRow label="Descripción:" value={formData.descripcion} />
            </div>
          ) : (
            <>
              <div className="form-group">
                <label htmlFor="area">Área *</label>
                <select id="area" name="area" value={formData.area} onChange={handleChange} className={allErrors.area ? 'input-error' : ''}>
                  <option value="">Seleccionar área</option>
                  {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
                {allErrors.area && <span className="error-text">{allErrors.area}</span>}
              </div>
              <div className="form-group">
                <label htmlFor="nombre">Nombre *</label>
                <input type="text" id="nombre" name="nombre" value={formData.nombre} onChange={handleChange} placeholder="Nombre del tratamiento" className={allErrors.nombre ? 'input-error' : ''} />
                {allErrors.nombre && <span className="error-text">{allErrors.nombre}</span>}
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="precio">Precio *</label>
                  <input type="text" id="precio" name="precio" value={formData.precio} onChange={handleChange} inputMode="decimal" placeholder="0.00" className={allErrors.precio ? 'input-error' : ''} />
                  {allErrors.precio && <span className="error-text">{allErrors.precio}</span>}
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="descripcion">Descripción</label>
                <textarea id="descripcion" name="descripcion" value={formData.descripcion} onChange={handleChange} placeholder="Descripción del tratamiento" rows={3} className={allErrors.descripcion ? 'input-error' : ''} />
                <div className="char-counter">{formData.descripcion?.length || 0}/300</div>
                {allErrors.descripcion && <span className="error-text">{allErrors.descripcion}</span>}
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
