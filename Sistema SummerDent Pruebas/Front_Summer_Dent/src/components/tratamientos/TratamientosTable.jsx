import { Eye, Edit2, Trash2 } from 'lucide-react';

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
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
