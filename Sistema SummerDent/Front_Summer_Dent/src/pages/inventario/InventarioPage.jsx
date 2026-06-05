import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import ConfirmModal from '../../components/ui/ConfirmModal';
import Button from '../../components/ui/Button';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchProductos, updateProducto, createProducto } from '../../services/api/productos';
import { createMovimientoFinanzas } from '../../services/api/movimientoFinanzas';
import { fetchInventarios, registrarMovimientoInventario } from '../../services/api/inventario';
import ErrorState from '../../components/feedback/ErrorState';
import InventarioModal from '../../components/inventario/InventarioModal';

const formatDate = (value) => {
  if (!value) return '-';

  // If the value is a string that starts with YYYY-MM-DD (either date-only
  // or ISO datetime), extract the date portion and format from components
  // to avoid timezone shifts that can add/subtract a day.
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    const datePart = value.slice(0, 10); // YYYY-MM-DD
    const [y, m, d] = datePart.split('-').map(Number);
    if ([y, m, d].some(Number.isNaN)) return '-';
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('es-EC', { year: 'numeric', month: '2-digit', day: '2-digit' });
  }

  // For non-string or other date inputs, parse and use UTC components so the
  // displayed calendar date matches the original timestamp's date portion
  // without local TZ offsets causing a day shift.
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy}`;
};

const formatCurrency = (value) => {
  if (value === undefined || value === null || value === '') return '-';
  const raw = Number(value);
  if (Number.isNaN(raw)) return '-';
  // normalize to 2 decimals to avoid floating point artifacts (e.g. 19.9999999)
  const num = Math.round(raw * 100) / 100;
  return new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(num);
};

const getLocalDateYYYYMMDD = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/*const toDateInputValue = (value) => {
  if (!value) return '';

  // If it's a date-only string, return as-is
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  // Build YYYY-MM-DD from local date parts to avoid UTC shift
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};*/

const getUpdateDate = (inventario) => {
  // prefer explicit fecha_actualizacion, then updated_at, then created_at; otherwise return null
  return inventario?.fecha_actualizacion || inventario?.updated_at || inventario?.created_at || null;
};

const getProductName = (inventario) => {
  if (inventario.producto?.nombre) return inventario.producto.nombre;
  return inventario.id_producto ? `Producto #${inventario.id_producto}` : '-';
};

const getStatus = (stock, minimo) => {
  const current = Number(stock || 0);
  const min = Number(minimo || 0);

  if (min > 0 && current <= 0) return 'critical';
  if (min > 0 && current <= min) return 'low';
  if (current > min) return 'ok';
  return 'unknown';
};

const getStatusLabel = (stock, minimo) => {
  const status = getStatus(stock, minimo);
  if (status === 'critical') return 'Stock Crítico';
  if (status === 'low') return 'Stock Bajo';
  if (status === 'ok') return 'Disponible';
  return 'Sin referencia';
};

const buildAlertSummary = (inventoryList) => {
  const lowStockItems = inventoryList.filter((item) => getStatus(item.stock_producto, item.stock_minimo) === 'low' || getStatus(item.stock_producto, item.stock_minimo) === 'critical');
  if (lowStockItems.length === 0) return null;

  const firstItem = lowStockItems[0];
  const remaining = lowStockItems.length - 1;

  return {
    count: lowStockItems.length,
    text: remaining > 0
      ? `${getProductName(firstItem)} y ${remaining} insumo(s) más necesitan reposición`
      : `${getProductName(firstItem)} necesita reposición`
  };
};

const INVENTARIO_POR_PAGINA = 15;

const STATUS_OPTIONS = [
  { value: 'todos', label: 'Todos' },
  { value: 'ok', label: 'Disponible' },
  { value: 'low', label: 'Stock Bajo' },
  { value: 'critical', label: 'Stock Crítico' }
];

export default function InventarioPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const sedeActiva = useAuthStore((s) => s.sedeActiva);
  const isSuperadmin = user && user.rol === 'superadmin';
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedInventarioId, setExpandedInventarioId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedInventario, setSelectedInventario] = useState(null);
  const [isViewMode, setIsViewMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [movementConfirmOpen, setMovementConfirmOpen] = useState(false);
  const [pendingMovementInventario, setPendingMovementInventario] = useState(null);
  const [pendingMovementQty, setPendingMovementQty] = useState(0);
  const [movementIsSaving, setMovementIsSaving] = useState(false);
  const [movementError, setMovementError] = useState('');
  const [movementAction, setMovementAction] = useState('choice');
  const [movementMontoCompra, setMovementMontoCompra] = useState('');
  const [movementMetodoPago, setMovementMetodoPago] = useState('efectivo');
  const [movementDetallePago, setMovementDetallePago] = useState('');
  const [movementFieldErrors, setMovementFieldErrors] = useState({});
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
  const statusSelectorRef = useRef(null);

  const resetMovementForm = () => {
    setPendingMovementQty(1);
    setMovementAction('choice');
    setMovementMontoCompra('');
    setMovementMetodoPago('efectivo');
    setMovementDetallePago('');
    setMovementFieldErrors({});
    setMovementError('');
  };

  const closeMovementModal = () => {
    setMovementConfirmOpen(false);
    setPendingMovementInventario(null);
    resetMovementForm();
  };

  const { data: inventarios = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['inventario'],
    queryFn: fetchInventarios
  });

  const { data: productos = [] } = useQuery({
    queryKey: ['productos'],
    queryFn: fetchProductos
  });

  const alertSummary = useMemo(() => buildAlertSummary(inventarios), [inventarios]);

  const filteredInventarios = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return inventarios.filter((item) => {
      const status = getStatus(item.stock_producto, item.stock_minimo);
      const matchesStatus = statusFilter === 'todos' || status === statusFilter;
      const matchesDate = true;

      const searchableFields = [
        getProductName(item),
        item.id_producto,
        item.id_perfil,
        item.stock_producto,
        item.stock_minimo,
        item.fecha_actualizacion,
        item.created_at,
        status
      ]
        .filter(Boolean)
        .map((field) => String(field).toLowerCase());

      const matchesSearch = !search || searchableFields.some((field) => field.includes(search));

      return matchesStatus && matchesDate && matchesSearch;
    });
  }, [inventarios, searchTerm, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredInventarios.length / INVENTARIO_POR_PAGINA));

  const paginatedInventarios = useMemo(() => {
    const startIndex = (currentPage - 1) * INVENTARIO_POR_PAGINA;
    return filteredInventarios.slice(startIndex, startIndex + INVENTARIO_POR_PAGINA);
  }, [currentPage, filteredInventarios]);

  const toggleInventarioDetails = (inventarioId) => {
    setExpandedInventarioId((currentId) => (currentId === inventarioId ? null : inventarioId));
  };

  const renderInventarioDetails = (inventario, status) => [
    { label: 'Precio', value: (() => {
      const raw = (
        inventario.precio !== undefined && inventario.precio !== null
          ? inventario.precio
          : inventario.producto?.precio
      );
      if (raw !== undefined && raw !== null && raw !== '') return formatCurrency(raw);
      const prodFromList = productos.find((p) => Number(p.id) === Number(inventario.id_producto));
      if (prodFromList && prodFromList.precio !== undefined && prodFromList.precio !== null && prodFromList.precio !== '') return formatCurrency(prodFromList.precio);
      return '-';
    })() },
    { label: 'Cantidad Actual', value: String(inventario.stock_producto ?? 0) },
    { label: 'Stock Mínimo', value: String(inventario.stock_minimo ?? 0) },
    { label: 'Fecha de Caducidad', value: formatDate(inventario.fecha_caducidad) },
    { label: 'Última Actualización', value: formatDate(getUpdateDate(inventario)) },
    { label: 'Estado', value: getStatusLabel(inventario.stock_producto, inventario.stock_minimo), status }
  ];

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    const handlePointerDown = (event) => {
      if (!statusSelectorRef.current?.contains(event.target)) {
        setIsStatusMenuOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsStatusMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const activeStatusLabel = STATUS_OPTIONS.find((option) => option.value === statusFilter)?.label || 'Todos';

  const handleStatusChange = (value) => {
    setStatusFilter(value);
    setIsStatusMenuOpen(false);
  };

  const openCreateModal = () => {
    setSelectedInventario(null);
    setIsViewMode(false);
    setErrorMessage('');
    setIsModalOpen(true);
  };

  const openEditModal = (inventario) => {
    setSelectedInventario(inventario);
    setIsViewMode(false);
    setErrorMessage('');
    setIsModalOpen(true);
  };

  const handleViewInventario = (inventario) => {
    setSelectedInventario(inventario);
    setIsViewMode(true);
    setErrorMessage('');
    setIsModalOpen(true);
  };

  const handleRegisterMovement = async (inventario) => {
    setPendingMovementInventario(inventario);
    resetMovementForm();
    setMovementConfirmOpen(true);
  };

  const confirmMovementAs = async (type) => {
    if (!pendingMovementInventario) return;
    setMovementIsSaving(true);
    try {
      const qty = Number(pendingMovementQty);
      if (!Number.isFinite(qty) || qty <= 0) throw new Error('Cantidad inválida');

      const normalizedType = String(type);
      const payload = {
        id_producto: pendingMovementInventario.id_producto,
        tipo_movimiento: normalizedType,
        cantidad: Math.floor(qty),
        fecha: getLocalDateYYYYMMDD()
      };

      if (normalizedType === 'entrada') {
        const montoCompra = Number(movementMontoCompra);
        if (!Number.isFinite(montoCompra) || montoCompra <= 0) {
          throw new Error('El valor de la compra es obligatorio y debe ser mayor a 0');
        }
        payload.monto = Number(montoCompra.toFixed(2));
        payload.metodo_pago = movementMetodoPago || 'efectivo';
        if (movementDetallePago) payload.detalle_pago = movementDetallePago;
      }

      if (normalizedType === 'salida' && movementMetodoPago) {
        payload.metodo_pago = movementMetodoPago;
        if (movementDetallePago) payload.detalle_pago = movementDetallePago;
      }

      await registrarMovimientoInventario(payload);
      queryClient.invalidateQueries({ queryKey: ['inventario'] });
      queryClient.invalidateQueries({ queryKey: ['egresos'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-snapshot'] });
      // Ensure caja/dashboard reflects the new movimiento immediately
      try {
        queryClient.invalidateQueries({ queryKey: ['caja-mensual'] });
        queryClient.invalidateQueries({ queryKey: ['caja-mensual-dashboard'] });
        queryClient.invalidateQueries({ queryKey: ['caja-mensual-history'] });
      } catch {
        // ignore
      }
      setMovementConfirmOpen(false);
      setPendingMovementInventario(null);
      resetMovementForm();
    } catch (error) {
      const raw = error.response?.data?.error || error.message || '';
      setMovementError(raw || 'No se pudo registrar el movimiento.');
    } finally {
      setMovementIsSaving(false);
    }
  };

  const handleSubmit = async (payload) => {
    setIsSaving(true);
    setErrorMessage('');

    try {
      // If payload includes nombre and no id_producto, create product (backend will also create inventario)
      if (!payload.id_producto && payload.nombre) {
        const createPayload = {
          nombre: payload.nombre,
          descripcion: payload.descripcion || null,
          categoria: payload.categoria || null,
          stock_producto: payload.stock_producto !== undefined ? payload.stock_producto : 0,
          stock_minimo: payload.stock_minimo !== undefined ? payload.stock_minimo : 0,
          precio: payload.precio !== undefined && payload.precio !== '' ? Number(payload.precio).toFixed(2) : 0,
          fecha_caducidad: payload.fecha_caducidad
        };

        const res = await createProducto(createPayload);
        // If registrarMovimiento requested after creation, register movement against created product
        const createdProductId = res?.producto?.id || res?.inventario?.id_producto || res?.producto?.id_producto;

        if (payload.registrarMovimiento && createdProductId) {
            await registrarMovimientoInventario({
              id_producto: createdProductId,
              tipo_movimiento: payload.tipo_movimiento,
              cantidad: payload.cantidad,
              fecha: getLocalDateYYYYMMDD()
            });
        }
      } else {
        const productId = payload.id_producto;
        const productData = productos.find((producto) => Number(producto.id) === Number(productId));

        if (!productData) {
          throw new Error('No se encontró el producto seleccionado');
        }

        const updatePayload = {
          nombre: payload.nombre ?? productData.nombre,
          descripcion: payload.descripcion ?? productData.descripcion ?? null,
          categoria: payload.categoria ?? productData.categoria ?? null,
          precio: payload.precio !== undefined && payload.precio !== '' ? Number(payload.precio).toFixed(2) : (productData.precio ?? 0),
          stock_producto: payload.stock_producto,
          stock_minimo: payload.stock_minimo,
          fecha_caducidad: payload.fecha_caducidad
        };
        console.log('Updating product', productId, updatePayload);
        await updateProducto(productId, updatePayload);

        // If stock decreased compared to previous inventory, create an automatic egreso
        try {
          const oldStock = Number(selectedInventario?.stock_producto ?? 0);
          const newStock = Number(payload.stock_producto !== undefined ? payload.stock_producto : (productData.stock_producto ?? 0));
          const delta = oldStock - newStock;
          if (delta > 0) {
            const pricePerUnit = Number(updatePayload.precio || productData.precio || 0);
            const monto = Math.round((pricePerUnit * delta) * 100) / 100;
            const nombreProducto = updatePayload.nombre || productData.nombre || 'producto';
            const movimientoPayload = {
              tipo: 'egreso',
              id_doctor: null,
              metodo_pago: null,
              monto: monto,
              descripcion: `Gasto de "${nombreProducto}" en tratamiento`,
              fecha: getLocalDateYYYYMMDD()
            };

            if (sedeActiva) movimientoPayload.sede_id = sedeActiva;
            await createMovimientoFinanzas(movimientoPayload);
            // refresh egresos and dashboard totals (per sede)
            queryClient.invalidateQueries({ queryKey: ['egresos', sedeActiva] });
            queryClient.invalidateQueries({ queryKey: ['dashboard-snapshot', sedeActiva] });
          }
        } catch (err) {
          console.error('No se pudo crear egreso automático por disminución de stock:', err);
          // don't block the main flow; surface a non-fatal message
          setErrorMessage('Producto actualizado, pero no se pudo registrar automáticamente el egreso.');
        }

        if (payload.registrarMovimiento) {
          await registrarMovimientoInventario({
            id_producto: productId,
            tipo_movimiento: payload.tipo_movimiento,
            cantidad: payload.cantidad,
            fecha: getLocalDateYYYYMMDD()
          });
        }
      }

      setIsModalOpen(false);
      setSelectedInventario(null);
      queryClient.invalidateQueries({ queryKey: ['inventario'] });
      queryClient.invalidateQueries({ queryKey: ['productos'] });
    } catch (error) {
      console.error('Error saving inventario:', error);
      const serverMsg = error?.response?.data?.error || error?.response?.data || null;
      const userMsg = serverMsg || error.message || 'No se pudo guardar el inventario.';
      setErrorMessage(userMsg);
    } finally {
      setIsSaving(false);
    }
  };

  if (isError) {
    return <ErrorState onRetry={refetch} />;
  }

  return (
    <div className="page-container inventario-page">
      <div className="page-header page-header--finance">
        <div>
          <h1>Gestión de Inventario</h1>
          <p>Controla los insumos y materiales del consultorio</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.75rem' }}>
          <button type="button" className="btn btn-primary" onClick={openCreateModal}>
            + Nuevo Insumo
          </button>
        </div>
      </div>

      {alertSummary && (
        <section className="inventario-alert-card">
          <div className="inventario-alert-card__title">
            <span style={{ fontSize: '1.3rem' }}>⚠️</span>
            Alertas de Stock Bajo
          </div>
          <div className="inventario-alert-card__body">
            {alertSummary.count} insumo{alertSummary.count !== 1 ? 's' : ''} necesita{alertSummary.count !== 1 ? 'n' : ''} reposición: {alertSummary.text}
          </div>
        </section>
      )}

      <div className="inventario-filters">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: '1 1 0' }}>
          <label style={{ fontWeight: 700, fontSize: '0.85rem' }}>Búsqueda</label>
          <div className="search-container search-container--finance search-container--compact">
            <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              className="search-input"
              placeholder="Buscar por producto, stock o perfil..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
        </div>

        {/* date filter removed per user request */}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginLeft: '0.75rem', flex: '0 0 auto' }}>
          <label style={{ fontWeight: 700, fontSize: '0.85rem' }}>Stock</label>
          <div className="inventario-status-selector" ref={statusSelectorRef}>
            <div className="inventario-status-selector__control">
              <button
                type="button"
                className="inventario-status-selector__trigger"
                aria-haspopup="listbox"
                aria-expanded={isStatusMenuOpen}
                onClick={() => setIsStatusMenuOpen((open) => !open)}
              >
                <span className="inventario-status-selector__trigger-text">{activeStatusLabel}</span>
              </button>
              <ChevronDown className="inventario-status-selector__chevron" size={18} aria-hidden="true" />
              {isStatusMenuOpen ? (
                <div className="inventario-status-selector__menu" role="listbox" aria-label="Selector de stock">
                  {STATUS_OPTIONS.map((option) => {
                    const isSelected = option.value === statusFilter;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        className={isSelected ? 'inventario-status-selector__item inventario-status-selector__item--active' : 'inventario-status-selector__item'}
                        onClick={() => handleStatusChange(option.value)}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>
        </div>
        <div className="inventario-legend">
          <span><i className="inventario-dot inventario-dot--ok" />Disponible</span>
          <span><i className="inventario-dot inventario-dot--low" />Stock Bajo</span>
          <span><i className="inventario-dot inventario-dot--critical" />Stock Crítico</span>
        </div>
      </div>

      {errorMessage && (
        <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
          {errorMessage}
        </div>
      )}

      <div className="table-container">
        {isLoading ? (
          <div className="skeleton-table">
            {[...Array(4)].map((_, index) => (
              <div key={index} className="skeleton-row skeleton-row--finance">
                <div className="skeleton-cell" style={{ width: '20%' }} />
                <div className="skeleton-cell" style={{ width: '12%' }} />
                <div className="skeleton-cell" style={{ width: '12%' }} />
                <div className="skeleton-cell" style={{ width: '16%' }} />
                <div className="skeleton-cell" style={{ width: '12%' }} />
                <div className="skeleton-cell" style={{ width: '10%' }} />
                  <div className="skeleton-cell" style={{ width: '10%' }} />
                <div className="skeleton-cell" style={{ width: '18%' }} />
              </div>
            ))}
          </div>
        ) : filteredInventarios.length === 0 ? (
          <div className="empty-state finance-empty-state">
            <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📦</div>
            <h3>No hay insumos para mostrar</h3>
            <p>Prueba cambiando los filtros o registra un nuevo insumo.</p>
          </div>
        ) : (
          <>
            <table className="inventario-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Precio</th>
                  <th className="inventario-col-center">Cantidad Actual</th>
                  <th className="inventario-col-center">Stock Mínimo</th>
                  <th>Fecha de Caducidad</th>
                  <th>Última Actualización</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
              {paginatedInventarios.map((inventario) => {
                const status = getStatus(inventario.stock_producto, inventario.stock_minimo);

                return (
                  <tr key={inventario.id}>
                    <td>
                      <span className="inventario-product-title">{getProductName(inventario)}</span>
                    </td>
                    <td>
                      {(() => {
                        const raw = (
                          inventario.precio !== undefined && inventario.precio !== null
                            ? inventario.precio
                            : inventario.producto?.precio
                        );
                        if (raw !== undefined && raw !== null && raw !== '') return formatCurrency(raw);
                        const prodFromList = productos.find((p) => Number(p.id) === Number(inventario.id_producto));
                        if (prodFromList && prodFromList.precio !== undefined && prodFromList.precio !== null && prodFromList.precio !== '') return formatCurrency(prodFromList.precio);
                        return '-';
                      })()}
                    </td>
                    <td className={`inventario-col-center inventario-stock-value inventario-stock-value--${status}`}>
                      {inventario.stock_producto ?? 0}
                    </td>
                    <td className="inventario-col-center">{inventario.stock_minimo ?? 0}</td>
                    <td>{formatDate(inventario.fecha_caducidad)}</td>
                    <td>{formatDate(getUpdateDate(inventario))}</td>
                    <td>
                      <span className={`inventory-status-badge inventory-status-badge--${status}`}>
                        {getStatusLabel(inventario.stock_producto, inventario.stock_minimo)}
                      </span>
                    </td>
                    <td className="table-actions">
                      <button
                        type="button"
                        className="inventario-action-btn inventario-action-btn--view"
                        onClick={() => handleViewInventario(inventario)}
                        aria-label="Ver detalle"
                        title="Ver detalle"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      </button>
                      {(() => {
                        const user = useAuthStore.getState().user;
                        const isSuperadmin = user && user.rol === 'superadmin';
                        return (
                          !isSuperadmin && (
                            <button
                              type="button"
                              className="inventario-action-btn inventario-action-btn--edit"
                              onClick={() => openEditModal(inventario)}
                              aria-label="Editar"
                              title="Editar"
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                <path d="M12 20h9" />
                                <path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                              </svg>
                            </button>
                          )
                        );
                      })()}
                      {!isSuperadmin && (
                        <button
                          type="button"
                          className="inventario-action-btn inventario-action-btn--movement"
                          onClick={() => handleRegisterMovement(inventario)}
                          aria-label="Registrar movimiento"
                          title="Registrar movimiento"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                            <path d="M17 1l4 4-4 4" />
                            <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                            <path d="M7 23l-4-4 4-4" />
                            <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                          </svg>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              </tbody>
            </table>

            <div className="inventario-mobile-list" aria-label="Tabla de inventario en móvil">
              {paginatedInventarios.map((inventario) => {
                const status = getStatus(inventario.stock_producto, inventario.stock_minimo);
                const isExpanded = expandedInventarioId === inventario.id;

                return (
                  <article key={inventario.id} className="inventario-mobile-card">
                    <div className="inventario-mobile-card__summary">
                      <button
                        type="button"
                        className="inventario-mobile-card__summary-toggle"
                        onClick={() => toggleInventarioDetails(inventario.id)}
                        aria-expanded={isExpanded}
                        aria-controls={`inventario-mobile-details-${inventario.id}`}
                      >
                        <span className="inventario-mobile-card__toggle" aria-hidden="true">
                          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </span>
                      </button>

                      <button
                        type="button"
                        className="inventario-mobile-card__summary-main"
                        onClick={() => toggleInventarioDetails(inventario.id)}
                        aria-expanded={isExpanded}
                        aria-controls={`inventario-mobile-details-${inventario.id}`}
                      >
                        <span className="inventario-mobile-card__product-label">Producto</span>
                        <span className="inventario-mobile-card__product-name">
                          <strong>{getProductName(inventario)}</strong>
                        </span>
                      </button>

                      <span className="inventario-mobile-card__summary-actions">
                        <button
                          type="button"
                          className="inventario-action-btn inventario-action-btn--view"
                          onClick={() => handleViewInventario(inventario)}
                          aria-label="Ver detalle"
                          title="Ver detalle"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                            <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        </button>
                        {!isSuperadmin && (
                          <button
                            type="button"
                            className="inventario-action-btn inventario-action-btn--edit"
                            onClick={() => openEditModal(inventario)}
                            aria-label="Editar"
                            title="Editar"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                              <path d="M12 20h9" />
                              <path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                            </svg>
                          </button>
                        )}
                        {!isSuperadmin && (
                          <button
                            type="button"
                            className="inventario-action-btn inventario-action-btn--movement"
                            onClick={() => handleRegisterMovement(inventario)}
                            aria-label="Registrar movimiento"
                            title="Registrar movimiento"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                              <path d="M17 1l4 4-4 4" />
                              <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                              <path d="M7 23l-4-4 4-4" />
                              <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                            </svg>
                          </button>
                        )}
                      </span>
                    </div>

                    {isExpanded ? (
                      <div className="inventario-mobile-card__details" id={`inventario-mobile-details-${inventario.id}`}>
                        {renderInventarioDetails(inventario, status).map((item) => (
                          <div key={item.label} className="inventario-mobile-card__row">
                            <span className="inventario-mobile-card__label">{item.label}</span>
                            <span className={item.label === 'Estado' ? `inventory-status-badge inventory-status-badge--${status}` : 'inventario-mobile-card__value'}>
                              {item.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>

            <div className="finance-pagination">
              <div className="finance-pagination__info">
                Mostrando {Math.min(filteredInventarios.length, (currentPage - 1) * INVENTARIO_POR_PAGINA + 1)}-
                {Math.min(filteredInventarios.length, currentPage * INVENTARIO_POR_PAGINA)} de {filteredInventarios.length}
              </div>
              <div className="finance-pagination__controls">
                <Button
                  variant="secondary"
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={currentPage <= 1}
                >
                  Anterior
                </Button>
                <span className="finance-pagination__page">Página {currentPage} de {totalPages}</span>
                <Button
                  variant="secondary"
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  disabled={currentPage >= totalPages}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      <InventarioModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedInventario(null);
          setIsViewMode(false);
        }}
        onSubmit={handleSubmit}
        initialData={selectedInventario}
        isLoading={isSaving}
        productos={productos}
        readOnly={isViewMode}
      />
      <ConfirmModal
        isOpen={movementConfirmOpen}
        title={movementAction === 'entrada' ? 'Registrar compra y stock' : movementAction === 'salida' ? 'Registrar venta' : 'Registrar Movimiento'}
        onConfirm={() => confirmMovementAs(movementAction)}
        onCancel={closeMovementModal}
        isLoading={movementIsSaving}
        confirmLabel={movementAction === 'entrada' ? 'Confirmar' : movementAction === 'salida' ? 'Confirmar Venta' : 'Confirmar'}
        cancelLabel="Cancelar"
        hideFooter={true}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {movementError && <div style={{ color: 'var(--danger)', fontSize: '0.9rem' }}>{movementError}</div>}
          <div>Registrar movimiento para: <strong>{getProductName(pendingMovementInventario || {})}</strong></div>
          <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span>Cantidad</span>
            <input
              type="number"
              min="1"
              value={pendingMovementQty}
              onChange={(e) => setPendingMovementQty(e.target.value)}
              style={{ width: '6rem', padding: '0.25rem' }}
            />
          </label>
          {movementFieldErrors.cantidad && <div style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>{movementFieldErrors.cantidad}</div>}

          {movementAction === 'choice' && (
            <div className="cm-modal-actions">
              <button type="button" className="cm-btn" onClick={closeMovementModal} disabled={movementIsSaving}>Cancelar</button>
              <button type="button" className="cm-btn cm-btn-confirm" onClick={() => { setMovementAction('salida'); setMovementError(''); setMovementFieldErrors({}); }} disabled={movementIsSaving}>Venta</button>
              <button type="button" className="cm-btn cm-btn-cancel" onClick={() => { setMovementAction('entrada'); setMovementError(''); setMovementFieldErrors({}); }} disabled={movementIsSaving}>Agregar Stock</button>
            </div>
          )}

          {movementAction === 'entrada' && (
            <div className="payment-section" style={{ padding: '1rem', border: '1px solid #eee', borderRadius: '6px', marginTop: '0.75rem' }}>
              <h3 style={{ margin: 0, marginBottom: '0.5rem' }}>Registrar gasto de compra</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div className="form-group">
                  <label htmlFor="mov_monto_compra">Dinero invertido / gastado</label>
                  <input
                    id="mov_monto_compra"
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={movementMontoCompra}
                    onChange={(e) => setMovementMontoCompra(e.target.value.replace(/[^0-9.]/g, ''))}
                    style={{ width: '100%', padding: '0.5rem' }}
                  />
                  {movementFieldErrors.monto && <span className="error-text">{movementFieldErrors.monto}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="mov_metodo_pago_compra">Método de pago</label>
                  <select id="mov_metodo_pago_compra" value={movementMetodoPago} onChange={(e) => setMovementMetodoPago(e.target.value)} style={{ width: '100%', padding: '0.5rem' }}>
                    <option value="efectivo">Efectivo</option>
                    <option value="transferencia">Transferencia</option>
                    <option value="deposito">Depósito bancario</option>
                    <option value="tarjeta">Tarjeta</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {movementAction === 'salida' && (
            <div className="payment-section" style={{ padding: '1rem', border: '1px solid #eee', borderRadius: '6px', marginTop: '0.75rem' }}>
              <h3 style={{ margin: 0, marginBottom: '0.5rem' }}>Registrar venta</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div className="form-group">
                  <label htmlFor="mov_metodo_pago">Método de pago</label>
                  <select id="mov_metodo_pago" value={movementMetodoPago} onChange={(e) => setMovementMetodoPago(e.target.value)} style={{ width: '100%', padding: '0.5rem' }}>
                    <option value="efectivo">Efectivo</option>
                    <option value="transferencia">Transferencia</option>
                    <option value="deposito">Depósito bancario</option>
                    <option value="tarjeta">Tarjeta</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="mov_detalle_pago">Detalle</label>
                  <textarea id="mov_detalle_pago" rows={3} value={movementDetallePago} onChange={(e) => setMovementDetallePago(e.target.value)} placeholder="Descripción breve del pago (opcional)" style={{ width: '100%', padding: '0.5rem' }} />
                </div>
              </div>
            </div>
          )}

          {movementAction === 'salida' && (
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
              <button type="button" className="cm-btn" onClick={closeMovementModal} disabled={movementIsSaving}>Cancelar</button>
              <button type="button" className="cm-btn cm-btn-confirm" onClick={() => confirmMovementAs('salida')} disabled={movementIsSaving}>Confirmar Venta</button>
            </div>
          )}

          {movementAction === 'entrada' && (
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
              <button type="button" className="cm-btn" onClick={closeMovementModal} disabled={movementIsSaving}>Cancelar</button>
              <button type="button" className="cm-btn cm-btn-confirm" onClick={() => confirmMovementAs('entrada')} disabled={movementIsSaving}>Confirmar</button>
            </div>
          )}

        </div>
      </ConfirmModal>
    </div>
  );
}
