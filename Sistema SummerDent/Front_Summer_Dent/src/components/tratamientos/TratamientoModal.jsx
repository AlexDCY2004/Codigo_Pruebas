import { useEffect, useMemo, useState } from 'react';

const AREAS_PERMITIDAS = [
  'Odontología General',
  'Ortodoncia',
  'Ortopedia',
  'Cirugía Odontológica',
  'Endodoncia',
  'Prótesis Removible Valplast o Flexible',
  'Acrílicas'
];

const initialFormState = {
  area: '',
  nombre: '',
  precio: '',
  descripcion: ''
};

const formatCurrency = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '-';

  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
};

const formatDate = (value) => {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleDateString('es-EC');
};

const ReadRow = ({ label, value }) => (
  <div className="tratamiento-read-row">
    <div className="tratamiento-read-label">{label}</div>
    <div className="tratamiento-read-value">{value || '-'}</div>
  </div>
);

export default function TratamientoModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  isLoading,
  readOnly = false
  , serverError = '',
  clearServerError = () => {},
  serverFieldErrors = {},
  clearServerFieldErrors = () => {}
}) {
  const [formData, setFormData] = useState(initialFormState);
  const [errors, setErrors] = useState({});

  const isEditing = Boolean(initialData?.id);

  const areaOptions = useMemo(() => AREAS_PERMITIDAS, []);

  useEffect(() => {
    let timer;
    if (initialData) {
      const next = {
        area: initialData.area || '',
        nombre: initialData.nombre || '',
        precio: initialData.precio !== undefined && initialData.precio !== null ? String(initialData.precio) : '',
        descripcion: initialData.descripcion || ''
      };
      timer = setTimeout(() => {
        setFormData(next);
        setErrors({});
      }, 0);
    } else {
      timer = setTimeout(() => {
        setFormData(initialFormState);
        setErrors({});
      }, 0);
    }

    return () => clearTimeout(timer);
  }, [initialData, isOpen]);

  const validateForm = () => {
    const nextErrors = {};

    if (!formData.area.trim()) {
      nextErrors.area = 'El área es obligatoria';
    }

    if (!formData.nombre.trim()) {
      nextErrors.nombre = 'El nombre es obligatorio';
    } else {
      const limpio = formData.nombre.trim();
      const letras = (limpio.match(/[A-Za-zÁÉÍÓÚáéíóúÑñ]/g) || []).length;
      if (letras < 5) {
        nextErrors.nombre = 'El nombre debe contener al menos 5 letras';
      } else if (limpio.length > 64) {
        nextErrors.nombre = 'El nombre no puede superar 64 caracteres';
      } else if (!/^[A-Za-z0-9ÁÉÍÓÚáéíóúÑñ\s\-\.,]+$/.test(limpio)) {
        nextErrors.nombre = 'El nombre contiene caracteres inválidos';
      }
    }

    const precioRaw = String(formData.precio || '').trim();
    const precioClean = precioRaw.replace(',', '.');

    if (!precioRaw) {
      nextErrors.precio = 'El precio es obligatorio';
    } else if (!/^\d{1,4}(\.\d{1,2})?$/.test(precioClean)) {
      nextErrors.precio = 'El precio puede tener hasta 4 dígitos y hasta 2 decimales';
    } else if (Number(precioClean) <= 0) {
      nextErrors.precio = 'El precio debe ser mayor a 0';
    } else if (Number(precioClean) > 9999.99) {
      nextErrors.precio = 'El precio no puede ser mayor a 9999.99';
    }

    if (formData.descripcion && formData.descripcion.length > 300) {
      nextErrors.descripcion = 'La descripción no puede superar 300 caracteres';
    }
    if (formData.descripcion && /@/.test(formData.descripcion)) {
      nextErrors.descripcion = 'La descripción no puede contener el carácter "@"';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    // sanitize specific fields while typing
    let nextValue = value;
    if (name === 'nombre') {
      // sanitize: remove '@' and other disallowed chars as user types
      nextValue = value.replace(/[^A-Za-z0-9ÁÉÍÓÚáéíóúÑñ\s\-\.,]/g, '');
    }
    if (name === 'descripcion') {
      // disallow the '@' character in descripcion
      nextValue = value.replace(/@/g, '');
    }

    setFormData((prev) => ({
      ...prev,
      [name]: nextValue
    }));

    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: ''
      }));
    }
    if (serverError) clearServerError();
    if (serverFieldErrors && serverFieldErrors[name]) {
      clearServerFieldErrors(name);
    }
  };

  const handlePaste = (event) => {
    const { name } = event.target;
    const paste = (event.clipboardData || window.clipboardData).getData('text') || '';
    if (name === 'nombre' || name === 'descripcion') {
      // Prevent raw paste and insert sanitized text (strip disallowed chars)
      event.preventDefault();
      const sanitized = paste.replace(/[^A-Za-z0-9ÁÉÍÓÚáéíóúÑñ\s\-\.,]/g, '');
      setFormData((prev) => ({ ...prev, [name]: (prev[name] || '') + sanitized }));

      if (errors[name]) {
        setErrors((prev) => ({ ...prev, [name]: '' }));
      }
      if (serverError) clearServerError();
      if (serverFieldErrors && serverFieldErrors[name]) {
        clearServerFieldErrors(name);
      }
    }
  };

  // Apply server field errors into local errors when they arrive
  useEffect(() => {
    let timer;
    if (serverFieldErrors && Object.keys(serverFieldErrors).length > 0) {
      timer = setTimeout(() => {
        setErrors((prev) => ({ ...prev, ...serverFieldErrors }));
      }, 0);
    }
    return () => clearTimeout(timer);
  }, [serverFieldErrors]);

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!validateForm()) return;

    const precioClean = String(formData.precio || '').trim().replace(',', '.');

    onSubmit({
      area: formData.area.trim(),
      nombre: formData.nombre.trim(),
      precio: Number(precioClean),
      descripcion: formData.descripcion.trim() || null
    });
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-content--large" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h2>{readOnly ? 'Ver Tratamiento' : isEditing ? 'Editar Tratamiento' : 'Nuevo Tratamiento'}</h2>
          <button type="button" className="modal-close" onClick={onClose}>✕</button>
        </div>

        <form className={`tratamiento-form ${readOnly ? 'tratamiento-form--readonly' : ''}`} noValidate onSubmit={handleSubmit}>
          {serverError && (
            <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
              {serverError}
            </div>
          )}
          {readOnly ? (
            <>
              <ReadRow label="Nombre:" value={formData.nombre} />
              <ReadRow label="Área:" value={formData.area} />
              <ReadRow label="Precio:" value={formatCurrency(formData.precio)} />
              <ReadRow label="Descripción:" value={formData.descripcion} />
              <ReadRow label="Fecha Registro:" value={formatDate(initialData?.created_at)} />

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary btn-detail-close" onClick={onClose}>
                  Cerrar
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="form-group">
                <label htmlFor="area">Área *</label>
                <select
                  id="area"
                  name="area"
                  value={formData.area}
                  onChange={handleChange}
                  onInvalid={(e) => e.preventDefault()}
                  className={errors.area ? 'input-error' : ''}
                >
                  <option value="">Seleccionar área</option>
                  {areaOptions.map((area) => (
                    <option key={area} value={area}>{area}</option>
                  ))}
                </select>
                {errors.area && <span className="error-text">{errors.area}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="nombre">Nombre *</label>
                <input
                  id="nombre"
                  name="nombre"
                  type="text"
                  value={formData.nombre}
                  onChange={handleChange}
                  onPaste={handlePaste}
                  onInvalid={(e) => e.preventDefault()}
                  placeholder="Limpieza Dental"
                  className={errors.nombre ? 'input-error' : ''}
                />
                {errors.nombre && <span className="error-text">{errors.nombre}</span>}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="precio">Precio *</label>
                  <input
                    id="precio"
                    name="precio"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.precio}
                    onChange={handleChange}
                    onInvalid={(e) => e.preventDefault()}
                    placeholder="0.00"
                    className={errors.precio ? 'input-error' : ''}
                  />
                  {errors.precio && <span className="error-text">{errors.precio}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="descripcion">Descripción</label>
                  <input
                    id="descripcion"
                    name="descripcion"
                    type="text"
                    value={formData.descripcion}
                    onChange={handleChange}
                    onPaste={handlePaste}
                    onInvalid={(e) => e.preventDefault()}
                    placeholder="Descripción del tratamiento"
                    className={errors.descripcion ? 'input-error' : ''}
                  />
                  {errors.descripcion && <span className="error-text">{errors.descripcion}</span>}
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
        </form>
      </div>
    </div>
  );
}
