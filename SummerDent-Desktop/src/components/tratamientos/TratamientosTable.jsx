import { useState } from 'react';
import { ChevronDown, ChevronUp, Eye, Edit2, Trash2 } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

const formatDate = (value) => {
  if (!value) return '-';
  try { return new Date(value).toLocaleDateString('es-EC', { year: 'numeric', month: '2-digit', day: '2-digit' }); }
  catch { return '-'; }
};

export default function TratamientosTable({ tratamientos, onEdit, onDelete, onView, isLoading }) {
  const user = useAuthStore((s) => s.user);
  const isSuperadmin = user && user.rol === 'superadmin';
  const [expandedId, setExpandedId] = useState(null);
  const toggle = (id) => setExpandedId((curr) => curr === id ? null : id);

  const renderActions = (tratamiento) => (
    <div className="table-actions table-actions--mobile">
      <button type="button" onClick={() => onView(tratamiento)} className="action-btn action-btn--view" title="Ver detalles"><Eye size={16} /></button>
      {!isSuperadmin && (
        <>
          <button type="button" onClick={() => onEdit(tratamiento)} className="action-btn action-btn--edit" title="Editar"><Edit2 size={16} /></button>
          <button type="button" onClick={() => onDelete(tratamiento)} className="action-btn action-btn--delete" title="Eliminar"><Trash2 size={16} /></button>
        </>
      )}
    </div>
  );

  const renderDetails = (tratamiento) => [
    { label: 'Área', value: tratamiento.area || '-' },
    { label: 'Precio', value: `$${Number(tratamiento.precio || 0).toFixed(2)}` },
    { label: 'Descripción', value: tratamiento.descripcion || '-' },
    { label: 'Registro', value: formatDate(tratamiento.created_at) }
  ];

  if (isLoading) {
    return (
      <div className="table-container">
        <div className="skeleton-table">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton-row">
              <div className="skeleton-cell" style={{ width: '18%' }} /><div className="skeleton-cell" style={{ width: '22%' }} />
              <div className="skeleton-cell" style={{ width: '12%' }} /><div className="skeleton-cell" style={{ width: '30%' }} />
              <div className="skeleton-cell" style={{ width: '7%' }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!tratamientos || tratamientos.length === 0) {
    return (
      <div className="empty-state">
        <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>💊</div>
        <h3>No hay tratamientos registrados</h3>
        <p>Agrega los tratamientos disponibles en el consultorio.</p>
      </div>
    );
  }

  return (
    <div className="table-container">
      <table className="tratamientos-table">
        <thead>
          <tr><th>Área</th><th>Nombre</th><th>Precio</th><th>Descripción</th><th>Acciones</th></tr>
        </thead>
        <tbody>
          {tratamientos.map((t) => (
            <tr key={t.id}>
              <td>{t.area || '-'}</td>
              <td><strong>{t.nombre || '-'}</strong></td>
              <td>${Number(t.precio || 0).toFixed(2)}</td>
              <td className="tratamiento-desc">{t.descripcion || '-'}</td>
              <td className="table-actions">
                <button type="button" onClick={() => onView(t)} className="action-btn action-btn--view" title="Ver detalles"><Eye size={16} /></button>
                {!isSuperadmin && (
                  <>
                    <button type="button" onClick={() => onEdit(t)} className="action-btn action-btn--edit" title="Editar"><Edit2 size={16} /></button>
                    <button type="button" onClick={() => onDelete(t)} className="action-btn action-btn--delete" title="Eliminar"><Trash2 size={16} /></button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="tratamientos-mobile-list">
        {tratamientos.map((t) => {
          const isExpanded = expandedId === t.id;
          return (
            <article key={t.id} className="tratamientos-mobile-card">
              <button type="button" className="tratamientos-mobile-card__summary" onClick={() => toggle(t.id)} aria-expanded={isExpanded}>
                <span aria-hidden="true">{isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</span>
                <span className="tratamientos-mobile-card__summary-main">
                  <span className="tratamientos-mobile-card__name-label">Nombre</span>
                  <span className="tratamientos-mobile-card__name"><strong>{t.nombre || '-'}</strong></span>
                </span>
                <span className="tratamientos-mobile-card__summary-actions" onClick={(e) => e.stopPropagation()}>{renderActions(t)}</span>
              </button>
              {isExpanded && (
                <div className="tratamientos-mobile-card__details">
                  {renderDetails(t).map((item) => (
                    <div key={item.label} className="tratamientos-mobile-card__row">
                      <span className="tratamientos-mobile-card__label">{item.label}</span>
                      <span className="tratamientos-mobile-card__value">{item.value}</span>
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
