import { useState } from 'react';
import { ChevronDown, ChevronUp, Eye, Edit2, Trash2 } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

const formatDate = (value) => {
  if (!value) return '-';
  try { return new Date(value).toLocaleDateString('es-EC', { year: 'numeric', month: '2-digit', day: '2-digit' }); }
  catch { return '-'; }
};

const trimTime = (value) => String(value || '').slice(0, 5);

const getPacienteName = (cita, pacientes) => {
  const p = pacientes.find((item) => String(item.id_cedula) === String(cita.id_paciente));
  return p ? `${p.nombre} ${p.apellido}`.trim() : cita.id_paciente || '-';
};

const getDoctorName = (cita, doctores) => {
  const d = doctores.find((item) => String(item.id) === String(cita.id_doctor));
  return d?.nombre || '-';
};

const getStatusBadgeClass = (status) => {
  const s = String(status || '').toLowerCase();
  if (s === 'atendida' || s === 'confirmada') return 'badge badge--ok';
  if (s === 'cancelada') return 'badge badge--warning';
  return 'badge badge--info';
};

export default function CitasTable({ citas, pacientes, doctores, onEdit, onDelete, onView, isLoading }) {
  const user = useAuthStore((s) => s.user);
  const isSuperadmin = user && user.rol === 'superadmin';
  const [expandedCitaId, setExpandedCitaId] = useState(null);
  const toggleCitaDetails = (id) => setExpandedCitaId((curr) => curr === id ? null : id);

  const renderCitaActions = (cita) => (
    <div className="table-actions table-actions--mobile">
      <button type="button" onClick={() => onView(cita)} className="action-btn action-btn--view" title="Ver detalles"><Eye size={16} /></button>
      {String(cita?.estado || '').toLowerCase() !== 'atendida' && !isSuperadmin && (
        <>
          <button type="button" onClick={() => onEdit(cita)} className="action-btn action-btn--edit" title="Editar"><Edit2 size={16} /></button>
          <button type="button" onClick={() => onDelete(cita)} className="action-btn action-btn--delete" title="Eliminar"><Trash2 size={16} /></button>
        </>
      )}
    </div>
  );

  const renderCitaDetails = (cita) => [
    { label: 'Paciente', value: getPacienteName(cita, pacientes) },
    { label: 'Odontólogo', value: getDoctorName(cita, doctores) },
    { label: 'Horario', value: `${trimTime(cita.hora_inicio)} - ${trimTime(cita.hora_fin)}` },
    { label: 'Tratamientos', value: cita.tratamientos || '-' },
    { label: 'Precio', value: `$${Number(cita.precio || 0).toFixed(2)}` },
    { label: 'Estado', value: cita.estado || '-' },
    { label: 'Registro', value: formatDate(cita.created_at) }
  ];

  if (isLoading) {
    return (
      <div className="table-container">
        <div className="skeleton-table">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton-row">
              <div className="skeleton-cell" style={{ width: '20%' }} /><div className="skeleton-cell" style={{ width: '15%' }} />
              <div className="skeleton-cell" style={{ width: '12%' }} /><div className="skeleton-cell" style={{ width: '15%' }} />
              <div className="skeleton-cell" style={{ width: '10%' }} /><div className="skeleton-cell" style={{ width: '10%' }} /><div className="skeleton-cell" style={{ width: '8%' }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!citas || citas.length === 0) {
    return (
      <div className="empty-state">
        <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📅</div>
        <h3>No hay citas registradas</h3>
        <p>Comienza agendando una nueva cita.</p>
      </div>
    );
  }

  return (
    <div className="table-container">
      <table className="citas-table">
        <thead>
          <tr><th>Paciente</th><th>Odontólogo</th><th>Fecha</th><th>Hora</th><th>Tratamientos</th><th>Precio</th><th>Estado</th><th>Acciones</th></tr>
        </thead>
        <tbody>
          {citas.map((cita) => (
            <tr key={cita.id}>
              <td><strong>{getPacienteName(cita, pacientes)}</strong></td>
              <td>{getDoctorName(cita, doctores)}</td>
              <td>{cita.fecha || '-'}</td>
              <td>{trimTime(cita.hora_inicio)} - {trimTime(cita.hora_fin)}</td>
              <td>{cita.tratamientos || '-'}</td>
              <td>${Number(cita.precio || 0).toFixed(2)}</td>
              <td><span className={getStatusBadgeClass(cita.estado)}>{cita.estado}</span></td>
              <td className="table-actions">
                <button type="button" onClick={() => onView(cita)} className="action-btn action-btn--view" title="Ver detalles"><Eye size={16} /></button>
                {String(cita?.estado || '').toLowerCase() !== 'atendida' && !isSuperadmin && (
                  <>
                    <button type="button" onClick={() => onEdit(cita)} className="action-btn action-btn--edit" title="Editar"><Edit2 size={16} /></button>
                    <button type="button" onClick={() => onDelete(cita)} className="action-btn action-btn--delete" title="Eliminar"><Trash2 size={16} /></button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="citas-mobile-list">
        {citas.map((cita) => {
          const isExpanded = expandedCitaId === cita.id;
          return (
            <article key={cita.id} className="citas-mobile-card">
              <button type="button" className="citas-mobile-card__summary" onClick={() => toggleCitaDetails(cita.id)} aria-expanded={isExpanded}>
                <span aria-hidden="true">{isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</span>
                <span className="citas-mobile-card__summary-main">
                  <span className="citas-mobile-card__name-label">Paciente</span>
                  <span className="citas-mobile-card__name"><strong>{getPacienteName(cita, pacientes)}</strong></span>
                </span>
                <span className="citas-mobile-card__summary-actions" onClick={(e) => e.stopPropagation()}>{renderCitaActions(cita)}</span>
              </button>
              {isExpanded && (
                <div className="citas-mobile-card__details">
                  {renderCitaDetails(cita).map((item) => (
                    <div key={item.label} className="citas-mobile-card__row">
                      <span className="citas-mobile-card__label">{item.label}</span>
                      <span className="citas-mobile-card__value">{item.value}</span>
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
