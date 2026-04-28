import { useEffect, useMemo, useState } from 'react';

const AREAS_PERMITIDAS = [
  'Ortodoncia General',
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
    } else if (formData.nombre.trim().length < 2 || formData.nombre.trim().length > 64) {
      nextErrors.nombre = 'El nombre debe tener entre 2 y 64 caracteres';
    }

    const precioRaw = String(formData.precio || '').trim();
    const precioClean = precioRaw.replace(',', '.');

    if (!precioRaw) {
      nextErrors.precio = 'El precio es obligatorio';
    } else if (!/^\d+(\.\d{1,2})?$/.test(precioClean)) {
      nextErrors.precio = 'El precio debe ser un número válido (hasta 2 decimales)';
    } else if (Number(precioClean) <= 0) {
      nextErrors.precio = 'El precio debe ser mayor a 0';
    }

    if (formData.descripcion && formData.descripcion.length > 300) {
      nextErrors.descripcion = 'La descripción no puede superar 300 caracteres';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

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
    if (serverError) clearServerError();
    if (serverFieldErrors && serverFieldErrors[name]) {
      clearServerFieldErrors(name);
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

        <form className={`tratamiento-form ${readOnly ? 'tratamiento-form--readonly' : ''}`} onSubmit={handleSubmit}>
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
                <button type="button" className="btn btn-secondary" onClick={onClose}>
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
                    placeholder="Descripción del tratamiento"
                    className={errors.descripcion ? 'input-error' : ''}
                  />
                  {errors.descripcion && <span className="error-text">{errors.descripcion}</span>}
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={onClose}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={isLoading}>
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
