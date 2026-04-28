import { Eye, Edit2, Trash2 } from 'lucide-react';

const formatLocalDate = (dateValue) => {
  if (!dateValue) return '-';
  try {
    const raw = String(dateValue).split('T')[0];
    const parts = raw.split('-');
    if (parts.length === 3) {
      const y = Number(parts[0]);
      const m = Number(parts[1]) - 1;
      const d = Number(parts[2]);
      const dateObj = new Date(y, m, d);
      return dateObj.toLocaleDateString('es-EC', { year: 'numeric', month: '2-digit', day: '2-digit' });
    }
  } catch {
    // fallback
  }
  try {
    return new Date(dateValue).toLocaleDateString('es-EC', { year: 'numeric', month: '2-digit', day: '2-digit' });
  } catch {
    return '-';
  }
};

const getEstadoBadgeClass = (estado) => {
  switch (estado?.toLowerCase()) {
    case 'confirmada':
      return 'badge-confirmed';
    case 'pendiente':
      return 'badge-pending';
    case 'atendida':
      return 'badge-attended';
    case 'cancelada':
      return 'badge-cancelled';
    default:
      return 'badge-default';
  }
};

export default function CitasTable({ citas, pacientes = [], doctores = [], tratamientos = [], onEdit, onDelete, onView, isLoading }) {
  const resolvePacienteNombre = (cita, pacientes = []) => {
    if (cita.paciente?.nombre) {
      return `${cita.paciente.nombre} ${cita.paciente.apellido}`.trim();
    }

    const paciente = pacientes.find((item) => String(item.id_cedula) === String(cita.id_paciente));
    return paciente ? `${paciente.nombre} ${paciente.apellido}`.trim() : '-';
  };

  const resolveDoctorNombre = (cita, doctores = []) => {
    if (cita.doctor?.nombre) {
      return cita.doctor.nombre;
    }

    const doctor = doctores.find((item) => String(item.id) === String(cita.id_doctor));
    return doctor ? doctor.nombre : '-';
  };

  const resolveTratamientoNombre = (cita, tratamientos = []) => {
    if (cita.tratamiento?.nombre) return cita.tratamiento.nombre;

    const tratamiento = tratamientos.find((item) => String(item.id) === String(cita.id_tratamiento));
    if (tratamiento) return tratamiento.nombre;

    return cita.tratamientos || '-';
  };

  if (isLoading) {
    return (
      <div className="table-container">
        <div className="skeleton-table">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton-row">
              <div className="skeleton-cell" style={{ width: '10%' }} />
              <div className="skeleton-cell" style={{ width: '8%' }} />
              <div className="skeleton-cell" style={{ width: '8%' }} />
              <div className="skeleton-cell" style={{ width: '12%' }} />
              <div className="skeleton-cell" style={{ width: '12%' }} />
              <div className="skeleton-cell" style={{ width: '12%' }} />
              <div className="skeleton-cell" style={{ width: '8%' }} />
              <div className="skeleton-cell" style={{ width: '8%' }} />
              <div className="skeleton-cell" style={{ width: '10%' }} />
              <div className="skeleton-cell" style={{ width: '12%' }} />
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
        <p>Comienza a agendar citas haciendo clic en el botón "Nueva Cita"</p>
      </div>
    );
  }

  return (
    <div className="table-container">
      <table className="citas-table">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Hora Inicio</th>
            <th>Hora Fin</th>
            <th>Paciente</th>
            <th>Odontólogo</th>
            <th>Tratamiento</th>
            <th>Estado</th>
            <th>Atendido</th>
            <th>Monto</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {citas.map((cita) => {
            const isAttended = cita.estado?.toLowerCase() === 'atendida';
            const pacienteNombre = resolvePacienteNombre(cita, pacientes);
            const doctorNombre = resolveDoctorNombre(cita, doctores);
            const tratamientoNombre = resolveTratamientoNombre(cita, tratamientos);
            
            return (
              <tr key={cita.id}>
                <td>{formatLocalDate(cita.fecha)}</td>
                <td>{cita.hora_inicio || '-'}</td>
                <td>{cita.hora_fin || '-'}</td>
                <td>
                  <strong>
                    {pacienteNombre}
                  </strong>
                </td>
                <td>{doctorNombre}</td>
                <td>{tratamientoNombre}</td>
                <td>
                  <span className={`badge ${getEstadoBadgeClass(cita.estado)}`}>
                    {cita.estado || 'Sin especificar'}
                  </span>
                </td>
                <td>{isAttended ? 'Sí' : 'No'}</td>
                <td>
                  {new Intl.NumberFormat('es-EC', {
                    style: 'currency',
                    currency: 'USD'
                  }).format(cita.precio || 0)}
                </td>
                <td className="table-actions">
                  <button
                    type="button"
                    onClick={() => onView(cita)}
                    className="action-btn action-btn--view"
                    title="Ver detalles"
                  >
                    <Eye size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onEdit(cita)}
                    className="action-btn action-btn--edit"
                    title="Editar"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(cita)}
                    className="action-btn action-btn--delete"
                    title="Eliminar"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
