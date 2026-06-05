import { useState } from 'react';
import { ChevronDown, ChevronUp, Eye, Edit2, Trash2 } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

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
  const user = useAuthStore((s) => s.user);
  const isSuperadmin = user && user.rol === 'superadmin';
  const [expandedDoctorId, setExpandedDoctorId] = useState(null);

  const toggleDoctorDetails = (doctorId) => {
    setExpandedDoctorId((currentId) => (currentId === doctorId ? null : doctorId));
  };

  const renderDoctorActions = (doctor) => (
    <div className="table-actions table-actions--mobile">
      <button
        type="button"
        onClick={() => onView(doctor)}
        className="action-btn action-btn--view"
        title="Ver detalles"
      >
        <Eye size={16} />
      </button>
      {!isSuperadmin && (
        <>
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
        </>
      )}
    </div>
  );

  const renderDoctorDetails = (doctor) => [
    { label: 'Teléfono', value: doctor.telefono || '-' },
    { label: 'Correo', value: doctor.correo || '-' },
    { label: 'Especialidad', value: doctor.especialidad || '-' },
    { label: 'Estado', value: doctor.estado || 'sin estado' },
    { label: 'Fecha Registro', value: formatDate(doctor.created_at) }
  ];

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
                {!isSuperadmin && (
                  <>
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
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="doctores-mobile-list" aria-label="Tabla de odontólogos en móvil">
        {doctores.map((doctor) => {
          const isExpanded = expandedDoctorId === doctor.id;

          return (
            <article key={doctor.id} className="doctores-mobile-card">
              <button
                type="button"
                className="doctores-mobile-card__summary"
                onClick={() => toggleDoctorDetails(doctor.id)}
                aria-expanded={isExpanded}
                aria-controls={`doctor-mobile-details-${doctor.id}`}
              >
                <span className="doctores-mobile-card__toggle" aria-hidden="true">
                  {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </span>

                <span className="doctores-mobile-card__summary-main">
                  <span className="doctores-mobile-card__doctor-label">Doctor</span>
                  <span className="doctores-mobile-card__doctor-name">
                    <strong>{doctor.nombre || '-'}</strong>
                  </span>
                </span>

                <span className="doctores-mobile-card__summary-actions" onClick={(event) => event.stopPropagation()}>
                  {renderDoctorActions(doctor)}
                </span>
              </button>

              {isExpanded ? (
                <div className="doctores-mobile-card__details" id={`doctor-mobile-details-${doctor.id}`}>
                  {renderDoctorDetails(doctor).map((item) => (
                    <div key={item.label} className="doctores-mobile-card__row">
                      <span className="doctores-mobile-card__label">{item.label}</span>
                      <span className="doctores-mobile-card__value">{item.value}</span>
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
