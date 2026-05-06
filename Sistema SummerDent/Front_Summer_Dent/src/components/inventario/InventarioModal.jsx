import { useMemo, useState } from 'react';

export default function InventarioModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  isLoading,
  productos = [],
  readOnly = false
}) {
  const [errors, setErrors] = useState({});

  const isEditing = Boolean(initialData?.id);

  const productOptions = useMemo(() => productos, [productos]);

  const formKey = isEditing
    ? `inventario-edit-${initialData.id}-${initialData.id_producto ?? 'sin-producto'}-${initialData.stock_producto ?? 'sin-stock'}-${initialData.stock_minimo ?? 'sin-minimo'}`
    : 'inventario-new';

  const formatDate = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('es-EC', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  const formatCurrency = (value) => {
    if (value === undefined || value === null || value === '') return '-';
    const amount = Number(value);
    if (Number.isNaN(amount)) return '-';
    return new Intl.NumberFormat('es-EC', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const ReadRow = ({ label, value }) => (
    <div className="finance-read-row">
      <div className="finance-read-label">{label}</div>
      <div className="finance-read-value">{value || '-'}</div>
    </div>
  );

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
    const registrarMovimiento = Boolean(formValues.registrarMovimiento);
    const cantidad = formValues.cantidad?.trim() || '';

    if (!idProducto) {
      // if no product selected, nombre is required to create a new product
      if (!nombre) nextErrors.nombre = 'Debes ingresar el nombre del producto';
    }

    if (!stockProducto && !isEditing) {
      nextErrors.stock_producto = 'El stock actual es obligatorio';
    } else if (stockProducto !== '' && (!/^\d+$/.test(stockProducto) || Number(stockProducto) < 0)) {
      nextErrors.stock_producto = 'El stock actual debe ser un entero >= 0';
    }

    if (stockMinimo === '') {
      nextErrors.stock_minimo = 'El stock mínimo es obligatorio';
    } else if (!/^\d+$/.test(stockMinimo) || Number(stockMinimo) < 0) {
      nextErrors.stock_minimo = 'El stock mínimo debe ser un entero >= 0';
    }

    if (registrarMovimiento) {
      if (!cantidad) {
        nextErrors.cantidad = 'La cantidad es obligatoria';
      } else if (!/^\d+$/.test(cantidad) || Number(cantidad) <= 0) {
        nextErrors.cantidad = 'La cantidad debe ser un entero mayor que 0';
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
            <ReadRow label="Cantidad Actual:" value={initialData?.stock_producto !== undefined ? String(initialData.stock_producto) : '0'} />
            <ReadRow label="Stock Mínimo:" value={initialData?.stock_minimo !== undefined ? String(initialData.stock_minimo) : '0'} />

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary btn-detail-close" onClick={closeModal}>Cerrar</button>
            </div>
          </div>
        ) : (
        <form key={formKey} className="inventario-form" onSubmit={handleSubmit}>
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
              />
            </div>

            <div className="form-group">
              <label htmlFor="categoria">Categoría</label>
              <input
                id="categoria"
                name="categoria"
                type="text"
                defaultValue={initialData?.producto?.categoria ?? initialData?.categoria ?? ''}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label htmlFor="precio">Precio</label>
              <input
                id="precio"
                name="precio"
                type="number"
                step="0.01"
                min="0"
                defaultValue={initialData?.precio !== undefined && initialData.precio !== null ? String(initialData.precio) : (initialData?.producto?.precio !== undefined && initialData.producto.precio !== null ? String(initialData.producto.precio) : '')}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="stock_producto">Cantidad Actual *</label>
              <input
                id="stock_producto"
                name="stock_producto"
                type="number"
                min="0"
                defaultValue={initialData?.stock_producto !== undefined ? String(initialData.stock_producto) : ''}
                onChange={handleChange}
                className={errors.stock_producto ? 'input-error' : ''}
                placeholder="0"
              />
              {errors.stock_producto && <span className="error-text">{errors.stock_producto}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="stock_minimo">Stock Mínimo *</label>
              <input
                id="stock_minimo"
                name="stock_minimo"
                type="number"
                min="0"
                defaultValue={initialData?.stock_minimo !== undefined ? String(initialData.stock_minimo) : ''}
                onChange={handleChange}
                className={errors.stock_minimo ? 'input-error' : ''}
                placeholder="0"
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
