import { Eye, Edit2, Trash2 } from 'lucide-react';

const getEstadoBadgeClass = (estado) => {
  switch ((estado || '').toLowerCase()) {
    case 'disponible':
      return 'doctor-badge doctor-badge--available';
    case 'no disponible':
      return 'doctor-badge doctor-badge--unavailable';
    case 'eventual':
      return 'doctor-badge doctor-badge--eventual';
    default:
      return 'doctor-badge doctor-badge--default';
  }
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

export default function DoctoresTable({ doctores, isLoading, onView, onEdit, onDelete }) {
  if (isLoading) {
    return (
      <div className="table-container">
        <div className="skeleton-table">
          {[...Array(4)].map((_, index) => (
            <div key={index} className="skeleton-row">
              <div className="skeleton-cell" style={{ width: '20%' }} />
              <div className="skeleton-cell" style={{ width: '12%' }} />
              <div className="skeleton-cell" style={{ width: '18%' }} />
              <div className="skeleton-cell" style={{ width: '18%' }} />
              <div className="skeleton-cell" style={{ width: '14%' }} />
              <div className="skeleton-cell" style={{ width: '12%' }} />
              <div className="skeleton-cell" style={{ width: '6%' }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!doctores || doctores.length === 0) {
    return (
      <div className="empty-state">
        <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🦷</div>
        <h3>No hay odontólogos registrados</h3>
        <p>Haz clic en "Nuevo Odontólogo" para registrar el primero.</p>
      </div>
    );
  }

  return (
    <div className="table-container">
      <table className="doctores-table">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Teléfono</th>
            <th>Correo</th>
            <th>Especialidad</th>
            <th>Estado</th>
            <th>Fecha Registro</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {doctores.map((doctor) => (
            <tr key={doctor.id}>
              <td>
                <strong>{doctor.nombre || '-'}</strong>
              </td>
              <td>{doctor.telefono || '-'}</td>
              <td>{doctor.correo || '-'}</td>
              <td>{doctor.especialidad || '-'}</td>
              <td>
                <span className={getEstadoBadgeClass(doctor.estado)}>
                  {doctor.estado || 'sin estado'}
                </span>
              </td>
              <td>{formatDate(doctor.created_at)}</td>
              <td className="table-actions">
                <button
                  type="button"
                  onClick={() => onView(doctor)}
                  className="action-btn action-btn--view"
                  title="Ver detalles"
                >
                  <Eye size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => onEdit(doctor)}
                  className="action-btn action-btn--edit"
                  title="Editar"
                >
                  <Edit2 size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(doctor)}
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
