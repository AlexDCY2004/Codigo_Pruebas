import { useState } from 'react';

// Nombre permite letras (incluyendo acentuadas), números, espacios, guión, guión bajo y slash
const nombreRegex = new RegExp("^[A-Za-z0-9\\u00C0-\\u017F\\s\\-_/]+$");
const categoriaRegex = new RegExp("^[A-Za-z\\u00C0-\\u017F\\s]+$");

const getTodayInputDate = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const getMaxInputDate = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 5);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const formatDate = (value) => {
  if (!value) return '-';
  const raw = String(value).split('T')[0];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return '-';
  const [year, month, day] = raw.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('es-EC', { year: 'numeric', month: '2-digit', day: '2-digit' });
};

const toInputDate = (value) => {
  if (!value) return '';
  const raw = String(value).split('T')[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const ReadRow = ({ label, value }) => (
  <div className="finance-read-row">
    <div className="finance-read-label">{label}</div>
    <div className="finance-read-value">{value || '-'}</div>
  </div>
);

export default function InventarioModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  isLoading,
  readOnly = false
}) {
  const [errors, setErrors] = useState({});

  const isEditing = Boolean(initialData?.id);

  const formKey = isEditing
    ? `inventario-edit-${initialData.id}-${initialData.id_producto ?? 'sin-producto'}-${initialData.stock_producto ?? 'sin-stock'}-${initialData.stock_minimo ?? 'sin-minimo'}-${initialData.fecha_caducidad ?? 'sin-caducidad'}`
    : 'inventario-new';

  const formatCurrency = (value) => {
    if (value === undefined || value === null || value === '') return '-';
    const amount = Number(value);
    if (Number.isNaN(amount)) return '-';
    return new Intl.NumberFormat('es-EC', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };


  const closeModal = () => {
    setErrors({});
    onClose();
  };

  const validateForm = (formValues) => {
    const nextErrors = {};
    const idProducto = formValues.id_producto?.trim() || '';
    const nombre = formValues.nombre?.trim() || '';
    const stockProducto = formValues.stock_producto?.trim() || '';
    const stockMinimo = formValues.stock_minimo?.trim() || '';
    const fechaCaducidad = formValues.fecha_caducidad?.trim() || '';
    const registrarMovimiento = Boolean(formValues.registrarMovimiento);
    const cantidad = formValues.cantidad?.trim() || '';
    const descripcion = formValues.descripcion?.trim() || '';
    const categoria = formValues.categoria?.trim() || '';
    const precio = formValues.precio !== undefined && formValues.precio !== null ? String(formValues.precio).trim() : '';
    const today = getTodayInputDate();

    if (!idProducto) {
      // if no product selected, nombre is required to create a new product
      if (!nombre) nextErrors.nombre = 'Debes ingresar el nombre del producto';
      else if (!nombreRegex.test(nombre)) nextErrors.nombre = 'El nombre contiene caracteres no permitidos';
      else if (/^\d+$/.test(nombre)) nextErrors.nombre = 'El nombre no puede contener solo números';

      if (!descripcion) nextErrors.descripcion = 'La descripción es obligatoria';
      if (!categoria) nextErrors.categoria = 'La categoría es obligatoria';
      else if (!categoriaRegex.test(categoria)) nextErrors.categoria = 'La categoría solo debe contener letras y espacios';
      if (!precio) nextErrors.precio = 'El precio es obligatorio';
      else if (!/^\d{1,4}(?:\.\d{1,2})?$/.test(precio)) nextErrors.precio = 'El precio debe tener hasta 4 dígitos y hasta 2 decimales';
      else if (Number(precio) > 9999.99) nextErrors.precio = 'El precio no puede ser mayor a 9999.99';
    } else {
      // If editing, still validate name characters if provided
      if (nombre && !nombreRegex.test(nombre)) nextErrors.nombre = 'El nombre contiene caracteres no permitidos';
      else if (nombre && /^\d+$/.test(nombre)) nextErrors.nombre = 'El nombre no puede contener solo números';
      if (categoria && !categoriaRegex.test(categoria)) nextErrors.categoria = 'La categoría solo debe contener letras y espacios';
      // If precio provided while editing, validate format and range
      if (precio) {
        if (!/^\d{1,4}(?:\.\d{1,2})?$/.test(precio)) nextErrors.precio = 'El precio debe tener hasta 4 dígitos y hasta 2 decimales';
        else if (Number(precio) > 9999.99) nextErrors.precio = 'El precio no puede ser mayor a 9999.99';
      }
    }

    if (!stockProducto && !isEditing) {
      nextErrors.stock_producto = 'El stock actual es obligatorio';
    } else if (stockProducto !== '' && (!/^\d{1,3}$/.test(stockProducto) || Number(stockProducto) < 0)) {
      nextErrors.stock_producto = 'El stock actual debe ser un entero entre 0 y 999';
    }

    if (stockMinimo === '') {
      nextErrors.stock_minimo = 'El stock mínimo es obligatorio';
    } else if (!/^\d{1,3}$/.test(stockMinimo) || Number(stockMinimo) < 0) {
      nextErrors.stock_minimo = 'El stock mínimo debe ser un entero entre 0 y 999';
    }

    const maxDate = getMaxInputDate();

    if (fechaCaducidad && !/^\d{4}-\d{2}-\d{2}$/.test(fechaCaducidad)) {
      nextErrors.fecha_caducidad = 'La fecha de caducidad debe tener formato YYYY-MM-DD';
    } else if (fechaCaducidad && fechaCaducidad < today) {
      nextErrors.fecha_caducidad = 'La fecha de caducidad no puede ser anterior a la fecha actual';
    } else if (fechaCaducidad && fechaCaducidad > maxDate) {
      nextErrors.fecha_caducidad = 'La fecha de caducidad no puede ser mayor a 5 años desde hoy';
    }

    if (registrarMovimiento) {
      if (!cantidad) {
        nextErrors.cantidad = 'La cantidad es obligatoria';
      } else if (!/^\d{1,3}$/.test(cantidad) || Number(cantidad) <= 0) {
        nextErrors.cantidad = 'La cantidad debe ser un entero entre 1 y 999';
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleChange = (event) => {
    const { name } = event.target;

    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateField = (fieldName, value) => {
    const nextErrors = { ...errors };
    if (fieldName === 'precio') {
      const v = String(value || '').trim();
      if (!v) nextErrors.precio = 'El precio es obligatorio';
      else if (!/^\d{1,4}(?:\.\d{1,2})?$/.test(v)) nextErrors.precio = 'El precio debe tener hasta 4 dígitos y hasta 2 decimales';
      else if (Number(v) > 9999.99) nextErrors.precio = 'El precio no puede ser mayor a 9999.99';
      else delete nextErrors.precio;
    }
    setErrors(nextErrors);
  };

  const sanitizePrecioInput = (raw) => {
    const s = String(raw || '');
    // allow digits and single dot
    let cleaned = s.replace(/[^0-9.]/g, '');
    if (!cleaned) return '';
    const firstDot = cleaned.indexOf('.');
    if (firstDot !== -1) {
      cleaned = cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '');
    }
    const parts = cleaned.split('.');
    let intPart = parts[0] || '';
    let decPart = parts[1] || '';
    intPart = intPart.slice(0, 4); // up to 4 integer digits
    decPart = decPart.slice(0, 2); // up to 2 decimals
    if (cleaned.endsWith('.') && decPart === '') {
      if (intPart === '') return '0.';
      return `${intPart}.`;
    }
    if (decPart) return `${intPart}.${decPart}`;
    return intPart;
  };

  const handlePrecioChange = (event) => {
    const { value } = event.target;
    const sanitized = sanitizePrecioInput(value);
    event.target.value = sanitized;
    handleChange(event);
  };

  const handlePrecioPaste = (event) => {
    event.preventDefault();
    const paste = (event.clipboardData || window.clipboardData).getData('text') || '';
    const sanitized = sanitizePrecioInput(paste);
    event.target.value = sanitized;
    handleChange(event);
  };

  const sanitizeInteger3Input = (raw) => {
    const s = String(raw || '');
    const cleaned = s.replace(/[^0-9]/g, '');
    return cleaned.slice(0, 3);
  };

  const handleInteger3Change = (event) => {
    const { value } = event.target;
    const sanitized = sanitizeInteger3Input(value);
    event.target.value = sanitized;
    handleChange(event);
  };

  const handleInteger3Paste = (event) => {
    event.preventDefault();
    const paste = (event.clipboardData || window.clipboardData).getData('text') || '';
    const sanitized = sanitizeInteger3Input(paste);
    event.target.value = sanitized;
    handleChange(event);
  };

  const sanitizeLettersInput = (raw) => {
    const cleaned = String(raw || '').replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñ\s]/g, '');
    return cleaned;
  };

  const handleLettersChange = (event) => {
    const { value } = event.target;
    const sanitized = sanitizeLettersInput(value);
    event.target.value = sanitized;
    handleChange(event);
  };

  const handleLettersPaste = (event) => {
    event.preventDefault();
    const paste = (event.clipboardData || window.clipboardData).getData('text') || '';
    const sanitized = sanitizeLettersInput(paste);
    event.target.value = sanitized;
    handleChange(event);
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const formValues = Object.fromEntries(new FormData(event.currentTarget).entries());
    formValues.registrarMovimiento = !!event.currentTarget.registrarMovimiento?.checked;

    if (!validateForm(formValues)) return;

    // pass through product creation fields if provided
    onSubmit({
      id_producto: formValues.id_producto ? Number(formValues.id_producto) : undefined,
      nombre: formValues.nombre?.trim() || undefined,
      descripcion: formValues.descripcion?.trim() || undefined,
      categoria: formValues.categoria?.trim() || undefined,
      precio: formValues.precio !== undefined && formValues.precio !== '' ? formValues.precio : undefined,
      stock_producto: formValues.stock_producto !== '' ? Number(formValues.stock_producto) : undefined,
      stock_minimo: Number(formValues.stock_minimo),
      fecha_caducidad: formValues.fecha_caducidad || undefined,
      registrarMovimiento: Boolean(formValues.registrarMovimiento),
      tipo_movimiento: formValues.tipo_movimiento || 'entrada',
      cantidad: formValues.cantidad !== '' ? Number(formValues.cantidad) : undefined
    });
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={closeModal}>
      <div className="modal-content modal-content--large" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h2>{readOnly ? 'Ver Insumo' : isEditing ? 'Editar Insumo' : 'Nuevo Insumo'}</h2>
          <button type="button" className="modal-close" onClick={closeModal}>✕</button>
        </div>

        {readOnly ? (
          <div className="inventario-form finance-form finance-form--readonly">
            <ReadRow label="Producto:" value={initialData?.producto?.nombre || initialData?.nombre || '-'} />
            <ReadRow label="Descripción:" value={initialData?.producto?.descripcion || initialData?.descripcion || '-'} />
            <ReadRow label="Categoría:" value={initialData?.producto?.categoria || initialData?.categoria || '-'} />
            <ReadRow
              label="Precio:"
              value={formatCurrency(
                initialData?.precio !== undefined && initialData?.precio !== null
                  ? initialData.precio
                  : initialData?.producto?.precio
              )}
            />
            <ReadRow label="Fecha de caducidad:" value={formatDate(initialData?.fecha_caducidad)} />
            <ReadRow label="Cantidad Actual:" value={initialData?.stock_producto !== undefined ? String(initialData.stock_producto) : '0'} />
            <ReadRow label="Stock Mínimo:" value={initialData?.stock_minimo !== undefined ? String(initialData.stock_minimo) : '0'} />

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary btn-detail-close" onClick={closeModal}>Cerrar</button>
            </div>
          </div>
        ) : (
        <form key={formKey} className="inventario-form" onSubmit={handleSubmit} noValidate onInvalid={(e) => e.preventDefault()}>
          {/* Do not show a product selector. When editing include a hidden id field so submit sends id_producto */}
          {isEditing && (
            <input type="hidden" name="id_producto" defaultValue={initialData?.id_producto ? String(initialData.id_producto) : ''} />
          )}

          {/* Product fields: show for both create and edit; when editing prefill from initialData */}
          <div className="new-product-fields">
            <div className="form-group">
              <label htmlFor="nombre">Nombre del producto *</label>
              <input
                id="nombre"
                name="nombre"
                type="text"
                defaultValue={initialData?.producto?.nombre ?? initialData?.nombre ?? ''}
                onChange={handleChange}
                className={errors.nombre ? 'input-error' : ''}
              />
              {errors.nombre && <span className="error-text">{errors.nombre}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="descripcion">Descripción</label>
              <input
                id="descripcion"
                name="descripcion"
                type="text"
                defaultValue={initialData?.producto?.descripcion ?? initialData?.descripcion ?? ''}
                onChange={handleChange}
                required
                className={errors.descripcion ? 'input-error' : ''}
              />
              {errors.descripcion && <span className="error-text">{errors.descripcion}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="categoria">Categoría</label>
              <input
                id="categoria"
                name="categoria"
                type="text"
                defaultValue={initialData?.producto?.categoria ?? initialData?.categoria ?? ''}
                onChange={handleLettersChange}
                onPaste={handleLettersPaste}
                required
                className={errors.categoria ? 'input-error' : ''}
              />
              {errors.categoria && <span className="error-text">{errors.categoria}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="precio">Precio</label>
              <input
                id="precio"
                name="precio"
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                maxLength={7}
                defaultValue={initialData?.precio !== undefined && initialData.precio !== null ? String(initialData.precio) : (initialData?.producto?.precio !== undefined && initialData.producto.precio !== null ? String(initialData.producto.precio) : '')}
                onChange={handlePrecioChange}
                onPaste={handlePrecioPaste}
                onBlur={(e) => validateField('precio', e.target.value)}
                required
                className={errors.precio ? 'input-error' : ''}
              />
              {errors.precio && <span className="error-text">{errors.precio}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="fecha_caducidad">Fecha de caducidad <span style={{ fontWeight: 400 }}>(opcional)</span></label>
              <input
                id="fecha_caducidad"
                name="fecha_caducidad"
                type="date"
                min={getTodayInputDate()}
                max={getMaxInputDate()}
                defaultValue={toInputDate(initialData?.fecha_caducidad)}
                onChange={handleChange}
                className={errors.fecha_caducidad ? 'input-error' : ''}
              />
              {errors.fecha_caducidad && <span className="error-text">{errors.fecha_caducidad}</span>}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="stock_producto">Cantidad Actual *</label>
              <input
                id="stock_producto"
                name="stock_producto"
                type="text"
                inputMode="numeric"
                placeholder="0"
                maxLength={3}
                defaultValue={initialData?.stock_producto !== undefined ? String(initialData.stock_producto) : ''}
                onChange={handleInteger3Change}
                onPaste={handleInteger3Paste}
                className={errors.stock_producto ? 'input-error' : ''}
              />
              {errors.stock_producto && <span className="error-text">{errors.stock_producto}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="stock_minimo">Stock Mínimo *</label>
              <input
                id="stock_minimo"
                name="stock_minimo"
                type="text"
                inputMode="numeric"
                placeholder="0"
                maxLength={3}
                defaultValue={initialData?.stock_minimo !== undefined ? String(initialData.stock_minimo) : ''}
                onChange={handleInteger3Change}
                onPaste={handleInteger3Paste}
                className={errors.stock_minimo ? 'input-error' : ''}
              />
              {errors.stock_minimo && <span className="error-text">{errors.stock_minimo}</span>}
            </div>
          </div>

          {/* Movement UI removed per request */}

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary btn-modal-cancel" onClick={closeModal}>Cancelar</button>
            <button type="submit" className="btn btn-primary btn-modal-save" disabled={isLoading}>
              {isLoading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
}
