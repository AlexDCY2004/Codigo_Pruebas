import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

const getInitialFormData = (initialData) => ({
  id_paciente: initialData?.id_paciente || '',
  id_doctor: initialData?.id_doctor || '',
  fecha: initialData?.fecha || '',
  hora_inicio: initialData?.hora_inicio || '',
  hora_fin: initialData?.hora_fin || '',
  precio: initialData?.precio ?? '',
  estado: initialData?.estado || 'agendada',
  tratamientos: initialData?.tratamientos || '',
  metodo_pago: initialData?.metodo_pago || '',
  detalle_pago: initialData?.detalle_pago || ''
});

const getTodayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const getMaxDateLocal = () => {
  const d = new Date();
  d.setMonth(d.getMonth() + 2);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function CitaModal({ isOpen, onClose, onSubmit, initialData, isLoading, pacientes = [], doctores = [], tratamientos = [], readOnly = false, isEditing = false, externalErrors = {} }) {
  const [formData, setFormData] = useState(() => getInitialFormData(initialData));
  const [selectedTratamientoIds, setSelectedTratamientoIds] = useState([]);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isOpen) {
      setFormData(getInitialFormData(initialData));
      setErrors({});

      if (initialData?.id && isEditing) {
        (async () => {
          const { data } = await supabase
            .from('cita_tratamiento')
            .select('tratamiento_id, precio')
            .eq('cita_id', initialData.id);
          if (data) {
            const ids = data.map(ct => Number(ct.tratamiento_id));
            setSelectedTratamientoIds(ids);
            if (ids.length > 0) {
              const total = data.reduce((sum, ct) => sum + Number(ct.precio || 0), 0);
              setFormData(prev => ({ ...prev, precio: total }));
            }
          }
        })();
      } else {
        setSelectedTratamientoIds([]);
      }
    }
  }, [isOpen, initialData]);

  const handleChange = (e) => {
    if (readOnly) return;
    const { name, value } = e.target;
    if (name === 'precio') {
      if (value === '' || /^\d{1,4}(\.\d{0,2})?$/.test(value)) {
        setFormData(prev => ({ ...prev, precio: value }));
      }
      return;
    }
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleTratamientoToggle = (tratamientoId) => {
    if (readOnly) return;
    setSelectedTratamientoIds(prev => {
      const id = Number(tratamientoId);
      let newIds;
      if (prev.includes(id)) {
        newIds = prev.filter(t => t !== id);
      } else {
        newIds = [...prev, id];
      }
      const total = newIds.reduce((sum, tid) => {
        const t = tratamientos.find(tr => Number(tr.id) === tid);
        return sum + Number(t?.precio || 0);
      }, 0);
      setFormData(prevForm => ({ ...prevForm, precio: total }));
      return newIds;
    });
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.id_paciente) newErrors.id_paciente = 'Paciente requerido';
    if (!formData.id_doctor) newErrors.id_doctor = 'Odontólogo requerido';
    if (!formData.fecha) newErrors.fecha = 'Fecha requerida';
    else if (formData.fecha < getTodayLocal()) newErrors.fecha = 'La fecha no puede ser anterior a hoy';
    else if (formData.fecha > getMaxDateLocal()) newErrors.fecha = 'La fecha máxima permitida es 2 meses a partir de hoy';
    if (!formData.hora_inicio) newErrors.hora_inicio = 'Hora inicio requerida';
    if (!formData.hora_fin) newErrors.hora_fin = 'Hora fin requerida';
    if (formData.hora_inicio && formData.hora_fin && formData.hora_inicio >= formData.hora_fin) newErrors.hora_fin = 'La hora de fin debe ser mayor a la hora de inicio';
    if (formData.estado === 'Atendida' && !formData.metodo_pago) newErrors.metodo_pago = 'Método de pago requerido para marcar como atendida';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
  e.preventDefault();
  if (readOnly) return;
  if (!validateForm()) return;

  // Creamos el payload inicial
  const payload = {
    ...formData,
    precio: formData.precio !== '' ? Number(formData.precio) : 0,
    tratamiento_id: selectedTratamientoIds.length > 0 ? selectedTratamientoIds : undefined
  };

  // CORRECCIÓN: Si el estado NO es atendida, sí limpiamos los campos. 
  // Pero si ES atendida, nos aseguramos de enviar lo que el usuario escribió o un string vacío, JAMÁS los eliminamos con delete.
  if (payload.estado !== 'Atendida') {
    delete payload.metodo_pago;
    delete payload.detalle_pago;
  } else {
    // Aseguramos que viajen los valores reales del formulario
    payload.metodo_pago = formData.metodo_pago || '';
    payload.detalle_pago = formData.detalle_pago || '';
  }

  delete payload.tratamientos;

  onSubmit(payload);
};

  if (!isOpen) return null;

  const pacienteLabel = (p) => `${p.nombre || ''} ${p.apellido || ''}`.trim() || p.id_cedula;
  const doctorLabel = (d) => `${d.nombre || ''} - ${d.especialidad || ''}`;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-content--cita" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{readOnly ? 'Ver Cita' : (initialData?.id ? 'Editar Cita' : 'Nueva Cita')}</h2>
          <button type="button" className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form className="cita-form" onSubmit={handleSubmit} noValidate>
          {externalErrors._form && <div className="alert alert-error" style={{ marginBottom: '0.75rem' }}>{externalErrors._form}</div>}

          <div className="form-row">
            <div className="form-group">
              <label>Paciente *</label>
              {readOnly ? (
                <div className="field-value">{pacientes.find(p => String(p.id_cedula) === String(formData.id_paciente))?.nombre || formData.id_paciente}</div>
              ) : (
                <select name="id_paciente" value={formData.id_paciente} onChange={handleChange} className={errors.id_paciente ? 'input-error' : ''}>
                  <option value="">Seleccionar paciente</option>
                  {pacientes.map(p => <option key={p.id_cedula} value={p.id_cedula}>{pacienteLabel(p)}</option>)}
                </select>
              )}
              {errors.id_paciente && <span className="error-text">{errors.id_paciente}</span>}
            </div>
            <div className="form-group">
              <label>Odontólogo *</label>
              {readOnly ? (
                <div className="field-value">{doctores.find(d => String(d.id) === String(formData.id_doctor))?.nombre || formData.id_doctor}</div>
              ) : (
                <select name="id_doctor" value={formData.id_doctor} onChange={handleChange} className={errors.id_doctor ? 'input-error' : ''}>
                  <option value="">Seleccionar odontólogo</option>
                  {doctores.map(d => <option key={d.id} value={d.id}>{doctorLabel(d)}</option>)}
                </select>
              )}
              {errors.id_doctor && <span className="error-text">{errors.id_doctor}</span>}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Fecha *</label>
              {readOnly ? <div className="field-value">{formData.fecha}</div> : (
                <input type="date" name="fecha" value={formData.fecha} onChange={handleChange} min={getTodayLocal()} max={getMaxDateLocal()} className={errors.fecha ? 'input-error' : ''} />
              )}
              {errors.fecha && <span className="error-text">{errors.fecha}</span>}
            </div>
            <div className="form-group">
              <label>Hora Inicio *</label>
              {readOnly ? <div className="field-value">{formData.hora_inicio}</div> : (
                <input type="time" name="hora_inicio" value={formData.hora_inicio} onChange={handleChange} className={errors.hora_inicio ? 'input-error' : ''} />
              )}
              {errors.hora_inicio && <span className="error-text">{errors.hora_inicio}</span>}
            </div>
            <div className="form-group">
              <label>Hora Fin *</label>
              {readOnly ? <div className="field-value">{formData.hora_fin}</div> : (
                <input type="time" name="hora_fin" value={formData.hora_fin} onChange={handleChange} className={errors.hora_fin ? 'input-error' : ''} />
              )}
              {errors.hora_fin && <span className="error-text">{errors.hora_fin}</span>}
            </div>
          </div>

          {!readOnly && (
            <div className="form-group">
              <label>Tratamientos</label>
              <div className="tratamientos-checklist">
                {tratamientos.map(t => (
                  <label key={t.id} className="tratamiento-checkbox">
                    <input type="checkbox" checked={selectedTratamientoIds.includes(Number(t.id))} onChange={() => handleTratamientoToggle(t.id)} />
                    <span>{t.nombre} - ${Number(t.precio || 0).toFixed(2)}</span>
                  </label>
                ))}
                {tratamientos.length === 0 && <p className="tratamientos-empty">No hay tratamientos disponibles</p>}
              </div>
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label>Precio</label>
              {readOnly ? <div className="field-value">${Number(formData.precio || 0).toFixed(2)}</div> : (
                <input type="text" name="precio" value={formData.precio} onChange={handleChange} inputMode="decimal" placeholder="0.00" />
              )}
            </div>
            <div className="form-group">
              <label>Estado</label>
              {readOnly ? <div className="field-value">{formData.estado}</div> : (
                <select name="estado" value={formData.estado} onChange={handleChange}>
                  <option value="agendada">Agendada</option>
                  <option value="confirmada">Confirmada</option>
                  <option value="Atendida">Atendida</option>
                  <option value="cancelada">Cancelada</option>
                </select>
              )}
            </div>
          </div>

          {formData.estado === 'Atendida' && !readOnly && (
            <div className="form-row">
              <div className="form-group">
                <label>Método de Pago *</label>
                <select name="metodo_pago" value={formData.metodo_pago} onChange={handleChange} className={errors.metodo_pago ? 'input-error' : ''}>
                  <option value="">Seleccionar método</option>
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="tarjeta">Tarjeta</option>
                </select>
                {errors.metodo_pago && <span className="error-text">{errors.metodo_pago}</span>}
              </div>
              <div className="form-group">
                <label>Detalle de Pago</label>
                <input type="text" name="detalle_pago" value={formData.detalle_pago} onChange={handleChange} placeholder="Detalle opcional" />
              </div>
            </div>
          )}

          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-secondary">{readOnly ? 'Cerrar' : 'Cancelar'}</button>
            {!readOnly && <button type="submit" className="btn btn-primary" disabled={isLoading}>{isLoading ? 'Guardando...' : 'Guardar'}</button>}
          </div>
        </form>
      </div>
    </div>
  );
}
