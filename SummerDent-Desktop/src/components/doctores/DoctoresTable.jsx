import { useState } from 'react';
import { ChevronDown, ChevronUp, Eye, Edit2, Trash2 } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

const formatDate = (value) => {
  if (!value) return '-';
  try { return new Date(value).toLocaleDateString('es-EC', { year: 'numeric', month: '2-digit', day: '2-digit' }); }
  catch { return '-'; }
};

const getEstadoBadgeClass = (estado) => {
  const s = String(estado || '').toLowerCase();
  if (s === 'disponible') return 'badge badge--ok';
  if (s === 'no disponible') return 'badge badge--warning';
  return 'badge badge--info';
};

export default function DoctoresTable({ doctores, onEdit, onDelete, onView, isLoading }) {
  const user = useAuthStore((s) => s.user);
  const isSuperadmin = user && user.rol === 'superadmin';
  const [expandedId, setExpandedId] = useState(null);
  const toggle = (id) => setExpandedId((curr) => curr === id ? null : id);

  const renderActions = (doctor) => (
    <div className="table-actions table-actions--mobile">
      <button type="button" onClick={() => onView(doctor)} className="action-btn action-btn--view" title="Ver detalles"><Eye size={16} /></button>
      {!isSuperadmin && (
        <>
          <button type="button" onClick={() => onEdit(doctor)} className="action-btn action-btn--edit" title="Editar"><Edit2 size={16} /></button>
          <button type="button" onClick={() => onDelete(doctor)} className="action-btn action-btn--delete" title="Eliminar"><Trash2 size={16} /></button>
        </>
      )}
    </div>
  );

  const renderDetails = (doctor) => [
    { label: 'Teléfono', value: doctor.telefono || '-' },
    { label: 'Correo', value: doctor.correo || '-' },
    { label: 'Especialidad', value: doctor.especialidad || '-' },
    { label: 'Estado', value: doctor.estado || '-' },
    { label: 'Registro', value: formatDate(doctor.created_at) }
  ];

  if (isLoading) {
    return (
      <div className="table-container">
        <div className="skeleton-table">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton-row">
              <div className="skeleton-cell" style={{ width: '22%' }} /><div className="skeleton-cell" style={{ width: '14%' }} />
              <div className="skeleton-cell" style={{ width: '20%' }} /><div className="skeleton-cell" style={{ width: '16%' }} />
              <div className="skeleton-cell" style={{ width: '12%' }} /><div className="skeleton-cell" style={{ width: '7%' }} />
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
        <p>Agrega odontólogos para empezar a gestionar citas.</p>
      </div>
    );
  }

  return (
    <div className="table-container">
      <table className="doctores-table">
        <thead>
          <tr><th>Nombre</th><th>Teléfono</th><th>Correo</th><th>Especialidad</th><th>Estado</th><th>Acciones</th></tr>
        </thead>
        <tbody>
          {doctores.map((doctor) => (
            <tr key={doctor.id}>
              <td><strong>{doctor.nombre || '-'}</strong></td>
              <td>{doctor.telefono || '-'}</td>
              <td>{doctor.correo || '-'}</td>
              <td>{doctor.especialidad || '-'}</td>
              <td><span className={getEstadoBadgeClass(doctor.estado)}>{doctor.estado}</span></td>
              <td className="table-actions">
                <button type="button" onClick={() => onView(doctor)} className="action-btn action-btn--view" title="Ver detalles"><Eye size={16} /></button>
                {!isSuperadmin && (
                  <>
                    <button type="button" onClick={() => onEdit(doctor)} className="action-btn action-btn--edit" title="Editar"><Edit2 size={16} /></button>
                    <button type="button" onClick={() => onDelete(doctor)} className="action-btn action-btn--delete" title="Eliminar"><Trash2 size={16} /></button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="doctores-mobile-list">
        {doctores.map((doctor) => {
          const isExpanded = expandedId === doctor.id;
          return (
            <article key={doctor.id} className="doctores-mobile-card">
              <button type="button" className="doctores-mobile-card__summary" onClick={() => toggle(doctor.id)} aria-expanded={isExpanded}>
                <span aria-hidden="true">{isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</span>
                <span className="doctores-mobile-card__summary-main">
                  <span className="doctores-mobile-card__name-label">Nombre</span>
                  <span className="doctores-mobile-card__name"><strong>{doctor.nombre || '-'}</strong></span>
                </span>
                <span className="doctores-mobile-card__summary-actions" onClick={(e) => e.stopPropagation()}>{renderActions(doctor)}</span>
              </button>
              {isExpanded && (
                <div className="doctores-mobile-card__details">
                  {renderDetails(doctor).map((item) => (
                    <div key={item.label} className="doctores-mobile-card__row">
                      <span className="doctores-mobile-card__label">{item.label}</span>
                      <span className="doctores-mobile-card__value">{item.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
