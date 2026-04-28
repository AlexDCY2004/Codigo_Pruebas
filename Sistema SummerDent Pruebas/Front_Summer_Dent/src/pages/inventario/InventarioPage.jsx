import { useMemo, useState } from 'react';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchProductos, updateProducto, createProducto } from '../../services/api/productos';
import { fetchInventarios, registrarMovimientoInventario } from '../../services/api/inventario';
import ErrorState from '../../components/feedback/ErrorState';
import InventarioModal from '../../components/inventario/InventarioModal';

const formatDate = (value) => {
  if (!value) return '-';

  // If value is date-only string like 'YYYY-MM-DD', construct a local Date
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('es-EC', { year: 'numeric', month: '2-digit', day: '2-digit' });
  }

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
  const raw = Number(value);
  if (Number.isNaN(raw)) return '-';
  // normalize to 2 decimals to avoid floating point artifacts (e.g. 19.9999999)
  const num = Math.round(raw * 100) / 100;
  return new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(num);
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

export default function InventarioPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
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
    // Open in-modal quantity input instead of native prompt
    setPendingMovementInventario(inventario);
    setPendingMovementQty(1);
    setMovementError('');
    setMovementConfirmOpen(true);
  };

  const confirmMovementAs = async (type) => {
    if (!pendingMovementInventario) return;
    setMovementIsSaving(true);
    try {
      const qty = Number(pendingMovementQty);
      if (!Number.isFinite(qty) || qty <= 0) throw new Error('Cantidad inválida');

      await registrarMovimientoInventario({
        id_producto: pendingMovementInventario.id_producto,
        tipo_movimiento: type,
        cantidad: Math.floor(qty)
      });
      // After movement, refresh cache from server so DB timestamps are authoritative
      queryClient.invalidateQueries({ queryKey: ['inventario'] });
      setMovementConfirmOpen(false);
      setPendingMovementInventario(null);
      setPendingMovementQty(0);
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
          precio: payload.precio !== undefined && payload.precio !== '' ? Number(payload.precio).toFixed(2) : 0
        };

        const res = await createProducto(createPayload);
        // If registrarMovimiento requested after creation, register movement against created product
        const createdProductId = res?.producto?.id || res?.inventario?.id_producto || res?.producto?.id_producto;

        if (payload.registrarMovimiento && createdProductId) {
          await registrarMovimientoInventario({
            id_producto: createdProductId,
            tipo_movimiento: payload.tipo_movimiento,
            cantidad: payload.cantidad
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
          stock_minimo: payload.stock_minimo
        };
        console.log('Updating product', productId, updatePayload);
        await updateProducto(productId, updatePayload);
        

        if (payload.registrarMovimiento) {
          await registrarMovimientoInventario({
            id_producto: productId,
            tipo_movimiento: payload.tipo_movimiento,
            cantidad: payload.cantidad
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
        <button type="button" className="btn btn-primary" onClick={openCreateModal}>
          + Nuevo Insumo
        </button>
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

      <div className="inventario-legend">
        <span><i className="inventario-dot inventario-dot--ok" />Disponible</span>
        <span><i className="inventario-dot inventario-dot--low" />Stock Bajo</span>
        <span><i className="inventario-dot inventario-dot--critical" />Stock Crítico</span>
      </div>

      <div className="inventario-filters">
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

        {/* date filter removed per user request */}

        <select
          className="search-input inventario-select"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
        >
          <option value="todos">Todos</option>
          <option value="ok">Disponible</option>
          <option value="low">Stock Bajo</option>
          <option value="critical">Stock Crítico</option>
        </select>
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
          <table className="inventario-table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Precio</th>
                <th className="inventario-col-center">Cantidad Actual</th>
                <th className="inventario-col-center">Stock Mínimo</th>
                <th>Última Actualización</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredInventarios.map((inventario) => {
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
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
        title="Registrar Movimiento"
        onConfirm={() => confirmMovementAs('entrada')}
        onCancel={() => setMovementConfirmOpen(false)}
        isLoading={movementIsSaving}
        confirmLabel="Entrada"
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
          <div className="cm-modal-actions">
            <button type="button" className="cm-btn" onClick={() => setMovementConfirmOpen(false)} disabled={movementIsSaving}>Cancelar</button>
            <button type="button" className="cm-btn cm-btn-confirm" onClick={() => confirmMovementAs('salida')} disabled={movementIsSaving}>Salida</button>
            <button type="button" className="cm-btn cm-btn-cancel" onClick={() => confirmMovementAs('entrada')} disabled={movementIsSaving}>Entrada</button>
          </div>

        </div>
      </ConfirmModal>
    </div>
  );
}
