import { Eye, Edit2, Trash2 } from 'lucide-react';

export default function PacientesTable({ pacientes, onEdit, onDelete, onView, isLoading }) {
  if (isLoading) {
    return (
      <div className="table-container">
        <div className="skeleton-table">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton-row">
              <div className="skeleton-cell" style={{ width: '20%' }} />
              <div className="skeleton-cell" style={{ width: '15%' }} />
              <div className="skeleton-cell" style={{ width: '15%' }} />
              <div className="skeleton-cell" style={{ width: '25%' }} />
              <div className="skeleton-cell" style={{ width: '12%' }} />
              <div className="skeleton-cell" style={{ width: '13%' }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!pacientes || pacientes.length === 0) {
    return (
      <div className="empty-state">
        <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>👥</div>
        <h3>No hay pacientes registrados</h3>
        <p>Comienza a agregar pacientes haciendo clic en el botón "Nuevo Paciente"</p>
      </div>
    );
  }

  return (
    <div className="table-container">
      <table className="patients-table">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Cédula</th>
            <th>Teléfono</th>
            <th>Dirección</th>
            <th>Fecha Registro</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {pacientes.map((paciente) => (
            <tr key={paciente.id_cedula}>
              <td>
                <strong>{paciente.nombre} {paciente.apellido}</strong>
              </td>
              <td>{paciente.id_cedula}</td>
              <td>{paciente.telefono || '-'}</td>
              <td>{paciente.direccion || '-'}</td>
              <td>
                {paciente.created_at
                  ? new Date(paciente.created_at).toLocaleDateString('es-EC', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit'
                    })
                  : '-'}
              </td>
              <td className="table-actions">
                <button
                  type="button"
                  onClick={() => onView(paciente)}
                  className="action-btn action-btn--view"
                  title="Ver detalles"
                >
                  <Eye size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => onEdit(paciente)}
                  className="action-btn action-btn--edit"
                  title="Editar"
                >
                  <Edit2 size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(paciente)}
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
