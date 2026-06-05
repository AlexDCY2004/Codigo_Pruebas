import { useState } from 'react';
import { ChevronDown, ChevronUp, Eye, Edit2, Trash2 } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

const formatCurrency = (value) => {
  const number = Number(value ?? 0);

  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD'
  }).format(Number.isFinite(number) ? number : 0);
};

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

export default function TratamientosTable({ tratamientos, isLoading, onView, onEdit, onDelete }) {
  const user = useAuthStore((s) => s.user);
  const isSuperadmin = user && user.rol === 'superadmin';
  const [expandedTratamientoId, setExpandedTratamientoId] = useState(null);

  const toggleTratamientoDetails = (tratamientoId) => {
    setExpandedTratamientoId((currentId) => (currentId === tratamientoId ? null : tratamientoId));
  };

  const renderTratamientoActions = (tratamiento) => (
    <div className="table-actions table-actions--mobile">
      <button
        type="button"
        onClick={() => onView(tratamiento)}
        className="action-btn action-btn--view"
        title="Ver detalles"
      >
        <Eye size={16} />
      </button>
      {!isSuperadmin && (
        <>
          <button
            type="button"
            onClick={() => onEdit(tratamiento)}
            className="action-btn action-btn--edit"
            title="Editar"
          >
            <Edit2 size={16} />
          </button>
          <button
            type="button"
            onClick={() => onDelete(tratamiento)}
            className="action-btn action-btn--delete"
            title="Eliminar"
          >
            <Trash2 size={16} />
          </button>
        </>
      )}
    </div>
  );

  const renderTratamientoDetails = (tratamiento) => [
    { label: 'Área', value: tratamiento.area || '-' },
    { label: 'Precio', value: formatCurrency(tratamiento.precio) },
    { label: 'Descripción', value: tratamiento.descripcion || '-' },
    { label: 'Fecha Registro', value: formatDate(tratamiento.created_at) }
  ];

  if (isLoading) {
    return (
      <div className="table-container">
        <div className="skeleton-table">
          {[...Array(5)].map((_, index) => (
            <div key={index} className="skeleton-row">
              <div className="skeleton-cell" style={{ width: '16%' }} />
              <div className="skeleton-cell" style={{ width: '20%' }} />
              <div className="skeleton-cell" style={{ width: '10%' }} />
              <div className="skeleton-cell" style={{ width: '30%' }} />
              <div className="skeleton-cell" style={{ width: '12%' }} />
              <div className="skeleton-cell" style={{ width: '12%' }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!tratamientos || tratamientos.length === 0) {
    return (
      <div className="empty-state">
        <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🧾</div>
        <h3>No hay tratamientos registrados</h3>
        <p>Haz clic en "Nuevo Tratamiento" para registrar el primero.</p>
      </div>
    );
  }

  return (
    <div className="table-container">
      <table className="tratamientos-table">
        <thead>
          <tr>
            <th>Área</th>
            <th>Nombre</th>
            <th>Precio</th>
            <th>Descripción</th>
            <th>Fecha Registro</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {tratamientos.map((tratamiento) => (
            <tr key={tratamiento.id}>
              <td>
                <span className="tratamiento-area">{tratamiento.area || '-'}</span>
              </td>
              <td>
                <strong>{tratamiento.nombre || '-'}</strong>
              </td>
              <td>{formatCurrency(tratamiento.precio)}</td>
              <td className="tratamiento-descripcion">{tratamiento.descripcion || '-'}</td>
              <td>{formatDate(tratamiento.created_at)}</td>
              <td className="table-actions">
                <button
                  type="button"
                  onClick={() => onView(tratamiento)}
                  className="action-btn action-btn--view"
                  title="Ver detalles"
                >
                  <Eye size={16} />
                </button>
                {!isSuperadmin && (
                  <>
                    <button
                      type="button"
                      onClick={() => onEdit(tratamiento)}
                      className="action-btn action-btn--edit"
                      title="Editar"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(tratamiento)}
                      className="action-btn action-btn--delete"
                      title="Eliminar"
                    >
                      <Trash2 size={16} />
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="tratamientos-mobile-list" aria-label="Tabla de tratamientos en móvil">
        {tratamientos.map((tratamiento) => {
          const isExpanded = expandedTratamientoId === tratamiento.id;

          return (
            <article key={tratamiento.id} className="tratamientos-mobile-card">
              <button
                type="button"
                className="tratamientos-mobile-card__summary"
                onClick={() => toggleTratamientoDetails(tratamiento.id)}
                aria-expanded={isExpanded}
                aria-controls={`tratamiento-mobile-details-${tratamiento.id}`}
              >
                <span className="tratamientos-mobile-card__toggle" aria-hidden="true">
                  {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </span>

                <span className="tratamientos-mobile-card__summary-main">
                  <span className="tratamientos-mobile-card__treatment-label">Tratamiento</span>
                  <span className="tratamientos-mobile-card__treatment-name">
                    <strong>{tratamiento.nombre || '-'}</strong>
                  </span>
                </span>

                <span className="tratamientos-mobile-card__summary-actions" onClick={(event) => event.stopPropagation()}>
                  {renderTratamientoActions(tratamiento)}
                </span>
              </button>

              {isExpanded ? (
                <div className="tratamientos-mobile-card__details" id={`tratamiento-mobile-details-${tratamiento.id}`}>
                  {renderTratamientoDetails(tratamiento).map((item) => (
                    <div key={item.label} className="tratamientos-mobile-card__row">
                      <span className="tratamientos-mobile-card__label">{item.label}</span>
                      <span className="tratamientos-mobile-card__value">{item.value}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}
