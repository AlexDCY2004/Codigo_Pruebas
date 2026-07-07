import { useState } from 'react';
import { ChevronDown, ChevronUp, Eye, Edit2, Trash2 } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

const formatDate = (value) => {
  if (!value) return '-';
  try { return new Date(value).toLocaleDateString('es-EC', { year: 'numeric', month: '2-digit', day: '2-digit' }); }
  catch { return '-'; }
};

const computeAgeFromDate = (fecha) => {
  if (!fecha) return '-';
  try {
    const d = new Date(fecha);
    if (Number.isNaN(d.getTime())) return '-';
    const now = new Date();
    let age = now.getFullYear() - d.getFullYear();
    const m = now.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
    return Number.isFinite(age) && age >= 0 ? String(age) : '-';
  } catch { return '-'; }
};

export default function PacientesTable({ pacientes, onEdit, onDelete, onView, isLoading }) {
  const user = useAuthStore((s) => s.user);
  const isSuperadmin = user && user.rol === 'superadmin';
  const [expandedPacienteId, setExpandedPacienteId] = useState(null);
  const togglePacienteDetails = (id) => setExpandedPacienteId((curr) => curr === id ? null : id);

  const renderPacienteActions = (paciente) => (
    <div className="table-actions table-actions--mobile">
      <button type="button" onClick={() => onView(paciente)} className="action-btn action-btn--view" title="Ver detalles"><Eye size={16} /></button>
      {!isSuperadmin && (
        <>
          <button type="button" onClick={() => onEdit(paciente)} className="action-btn action-btn--edit" title="Editar"><Edit2 size={16} /></button>
          <button type="button" onClick={() => onDelete(paciente)} className="action-btn action-btn--delete" title="Eliminar"><Trash2 size={16} /></button>
        </>
      )}
    </div>
  );

  const renderPacienteDetails = (paciente) => [
    { label: 'Edad (años)', value: computeAgeFromDate(paciente.fecha_nacimiento || paciente.fechaNacimiento || null) },
    { label: 'Cédula', value: paciente.id_cedula || '-' },
    { label: 'Teléfono', value: paciente.telefono || '-' },
    { label: 'Dirección', value: paciente.direccion || '-' },
    { label: 'Fecha Registro', value: formatDate(paciente.created_at) }
  ];

  if (isLoading) {
    return (
      <div className="table-container">
        <div className="skeleton-table">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton-row">
              <div className="skeleton-cell" style={{ width: '20%' }} /><div className="skeleton-cell" style={{ width: '8%' }} />
              <div className="skeleton-cell" style={{ width: '15%' }} /><div className="skeleton-cell" style={{ width: '25%' }} />
              <div className="skeleton-cell" style={{ width: '12%' }} /><div className="skeleton-cell" style={{ width: '13%' }} /><div className="skeleton-cell" style={{ width: '7%' }} />
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
          <tr><th>Nombre</th><th>Edad (años)</th><th>Cédula</th><th>Teléfono</th><th>Dirección</th><th>Fecha Registro</th><th>Acciones</th></tr>
        </thead>
        <tbody>
          {pacientes.map((paciente) => {
            const nombre = `${paciente.nombre || ''} ${paciente.apellido || ''}`.trim() || '-';
            const edad = computeAgeFromDate(paciente.fecha_nacimiento || paciente.fechaNacimiento || null);
            return (
              <tr key={paciente.id_cedula}>
                <td><strong>{nombre}</strong></td>
                <td>{edad}</td><td>{paciente.id_cedula}</td><td>{paciente.telefono || '-'}</td>
                <td>{paciente.direccion || '-'}</td><td>{formatDate(paciente.created_at)}</td>
                <td className="table-actions">
                  <button type="button" onClick={() => onView(paciente)} className="action-btn action-btn--view" title="Ver detalles"><Eye size={16} /></button>
                  {!isSuperadmin && (
                    <>
                      <button type="button" onClick={() => onEdit(paciente)} className="action-btn action-btn--edit" title="Editar"><Edit2 size={16} /></button>
                      <button type="button" onClick={() => onDelete(paciente)} className="action-btn action-btn--delete" title="Eliminar"><Trash2 size={16} /></button>
                    </>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="patients-mobile-list">
        {pacientes.map((paciente) => {
          const nombre = `${paciente.nombre || ''} ${paciente.apellido || ''}`.trim() || '-';
          const isExpanded = expandedPacienteId === paciente.id_cedula;
          return (
            <article key={paciente.id_cedula} className="patients-mobile-card">
              <button type="button" className="patients-mobile-card__summary" onClick={() => togglePacienteDetails(paciente.id_cedula)} aria-expanded={isExpanded}>
                <span aria-hidden="true">{isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</span>
                <span className="patients-mobile-card__summary-main">
                  <span className="patients-mobile-card__name-label">Nombre</span>
                  <span className="patients-mobile-card__name"><strong>{nombre}</strong></span>
                </span>
                <span className="patients-mobile-card__summary-actions" onClick={(e) => e.stopPropagation()}>{renderPacienteActions(paciente)}</span>
              </button>
              {isExpanded && (
                <div className="patients-mobile-card__details">
                  {renderPacienteDetails(paciente).map((item) => (
                    <div key={item.label} className="patients-mobile-card__row">
                      <span className="patients-mobile-card__label">{item.label}</span>
                      <span className="patients-mobile-card__value">{item.value}</span>
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
