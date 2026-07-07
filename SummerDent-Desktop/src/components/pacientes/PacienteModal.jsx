import { useState } from 'react';

const getInitialFormData = (initialData) => ({
  id_cedula: initialData?.id_cedula || '',
  nombre: initialData?.nombre || '',
  apellido: initialData?.apellido || '',
  fecha_nacimiento: initialData?.fecha_nacimiento || '',
  telefono: initialData?.telefono || '',
  correo: initialData?.correo || '',
  direccion: initialData?.direccion || ''
});

function ReadRow({ label, value }) {
  return (
    <div className="field-row">
      <div className="field-label">{label}</div>
      <div className="field-value">{value ?? '-'}</div>
    </div>
  );
}

const validarCedulaEcuatoriana = (cedula) => {
  const provincia = parseInt(cedula.substring(0, 2), 10);
  if (provincia < 1 || provincia > 24) return false;
  const tercerDigito = parseInt(cedula[2], 10);
  if (tercerDigito < 0 || tercerDigito > 5) return false;
  const coeficientes = [2, 1, 2, 1, 2, 1, 2, 1, 2];
  let suma = 0;
  for (let i = 0; i < 9; i++) {
    let p = parseInt(cedula[i], 10) * coeficientes[i];
    if (p >= 10) p -= 9;
    suma += p;
  }
  const digitoVerificador = parseInt(cedula[9], 10);
  const digitoCalculado = suma % 10 === 0 ? 0 : 10 - (suma % 10);
  return digitoCalculado === digitoVerificador;
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

export default function PacienteModal({ isOpen, onClose, onSubmit, initialData, isLoading, readOnly = false, isEditing = false, externalErrors = {}, onClearExternalError, onCheckCedula }) {
  const [formData, setFormData] = useState(() => getInitialFormData(initialData));
  const [errors, setErrors] = useState({});
  const [isCedulaDuplicada, setIsCedulaDuplicada] = useState(false);
  const allErrors = { ...errors, ...externalErrors };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.id_cedula?.trim()) newErrors.id_cedula = 'Cédula requerida';
    else if (formData.id_cedula.trim().length !== 10) newErrors.id_cedula = 'La cédula debe tener 10 dígitos';
    else if (!validarCedulaEcuatoriana(formData.id_cedula.trim())) newErrors.id_cedula = 'Cédula ecuatoriana inválida';
    else if (isCedulaDuplicada) newErrors.id_cedula = 'La cédula ya está registrada';
    if (!formData.nombre?.trim()) newErrors.nombre = 'Nombre requerido';
    if (!formData.apellido?.trim()) newErrors.apellido = 'Apellido requerido';
    if (!formData.fecha_nacimiento) newErrors.fecha_nacimiento = 'Fecha de nacimiento requerida';
    else {
      const d = new Date(formData.fecha_nacimiento);
      if (Number.isNaN(d.getTime())) newErrors.fecha_nacimiento = 'Fecha de nacimiento inválida';
      else {
        const now = new Date();
        let age = now.getFullYear() - d.getFullYear();
        const m = now.getMonth() - d.getMonth();
        if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
        if (age < 2) newErrors.fecha_nacimiento = 'El paciente debe tener al menos 2 años.';
        else if (age > 60) newErrors.fecha_nacimiento = 'La edad debe ser menor o igual a 60 años';
      }
    }
    if (formData.correo) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.correo)) newErrors.correo = 'Ingrese un correo válido.';
    }
    if (formData.telefono) {
      const tel = String(formData.telefono).trim();
      if (!/^\d{10}$/.test(tel)) newErrors.telefono = 'El teléfono debe contener solo 10 dígitos';
      else if (/(\d)\1{3,}/.test(tel)) newErrors.telefono = 'El teléfono no puede tener más de 3 dígitos iguales consecutivos';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    if (readOnly) return;
    const { name, value } = e.target;
    if ((name === 'id_cedula' || name === 'telefono') && (!/^\d*$/.test(value) || value.length > 10)) return;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
    if (externalErrors[name]) onClearExternalError(name);
    if (name === 'id_cedula') setIsCedulaDuplicada(false);
  };

  const handlePaste = (e) => {
    if (readOnly) return;
    const name = e.target?.name;
    if (name === 'id_cedula' || name === 'telefono') {
      const paste = (e.clipboardData || window.clipboardData).getData('text');
      const digits = paste.replace(/\D/g, '').slice(0, 10);
      e.preventDefault();
      setFormData(prev => ({ ...prev, [name]: (String(prev[name] || '') + digits).slice(0, 10) }));
      if (externalErrors[name]) onClearExternalError(name);
      if (name === 'id_cedula') setIsCedulaDuplicada(false);
    }
  };

  const handleCedulaBlur = async () => {
    if (readOnly || isEditing || !onCheckCedula) return;
    const cedula = formData.id_cedula?.trim();
    if (cedula.length === 10) {
      if (!validarCedulaEcuatoriana(cedula)) {
        setErrors(prev => ({ ...prev, id_cedula: 'Cédula ecuatoriana inválida' }));
        return;
      }
      if (externalErrors.id_cedula) onClearExternalError('id_cedula');
      const exists = await onCheckCedula(cedula);
      setIsCedulaDuplicada(exists);
      if (exists) {
        setErrors(prev => ({ ...prev, id_cedula: 'La cédula ya está registrada' }));
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (readOnly) return;
    if (!validateForm()) return;
    if (!isEditing && onCheckCedula && formData.id_cedula?.trim().length === 10) {
      if (!validarCedulaEcuatoriana(formData.id_cedula.trim())) {
        setErrors(prev => ({ ...prev, id_cedula: 'Cédula ecuatoriana inválida' }));
        return;
      }
      const alreadyExists = await onCheckCedula(formData.id_cedula.trim());
      if (alreadyExists) {
        setIsCedulaDuplicada(true);
        setErrors(prev => ({ ...prev, id_cedula: 'La cédula ya está registrada' }));
        return;
      }
    }
    onSubmit(formData);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-content--paciente" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{readOnly ? 'Ver Paciente' : (initialData?.id_cedula ? 'Editar Paciente' : 'Nuevo Paciente')}</h2>
          <button type="button" className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} noValidate className={`patient-form ${readOnly ? 'is-readonly' : ''}`}>
          {readOnly ? (
            <>
              <ReadRow label="Cédula:" value={formData.id_cedula} />
              <ReadRow label="Nombre:" value={formData.nombre} />
              <ReadRow label="Apellido:" value={formData.apellido} />
            </>
          ) : (
            <>
              <div className="form-group">
                <label htmlFor="id_cedula">Cédula *</label>
                {isEditing ? (
                  <input type="text" id="id_cedula" name="id_cedula" value={formData.id_cedula} onChange={handleChange} placeholder="1234567890" className={allErrors.id_cedula ? 'input-error' : ''} disabled />
                ) : (
                  <input type="text" id="id_cedula" name="id_cedula" value={formData.id_cedula} onChange={handleChange} onBlur={handleCedulaBlur} onPaste={handlePaste} placeholder="1234567890" className={allErrors.id_cedula ? 'input-error' : ''} maxLength={10} inputMode="numeric" />
                )}
                {allErrors.id_cedula && <span className="error-text">{allErrors.id_cedula}</span>}
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="nombre">Nombre *</label>
                  <input type="text" id="nombre" name="nombre" value={formData.nombre} onChange={handleChange} placeholder="Juan" className={allErrors.nombre ? 'input-error' : ''} />
                  {allErrors.nombre && <span className="error-text">{allErrors.nombre}</span>}
                </div>
                <div className="form-group">
                  <label htmlFor="apellido">Apellido *</label>
                  <input type="text" id="apellido" name="apellido" value={formData.apellido} onChange={handleChange} placeholder="Pérez" className={allErrors.apellido ? 'input-error' : ''} />
                  {allErrors.apellido && <span className="error-text">{allErrors.apellido}</span>}
                </div>
              </div>
            </>
          )}
          {readOnly ? (
            <>
              <ReadRow label="Fecha de Nacimiento:" value={formData.fecha_nacimiento} />
              <ReadRow label="Edad:" value={(computeAgeFromDate(formData.fecha_nacimiento) === '-' ? '-' : `${computeAgeFromDate(formData.fecha_nacimiento)} años`)} />
              <ReadRow label="Teléfono:" value={formData.telefono} />
              <ReadRow label="Correo:" value={formData.correo} />
              <ReadRow label="Dirección:" value={formData.direccion} />
            </>
          ) : (
            <>
              <div className="form-group">
                <label htmlFor="fecha_nacimiento">Fecha de Nacimiento *</label>
                <input type="date" id="fecha_nacimiento" name="fecha_nacimiento" value={formData.fecha_nacimiento} onChange={handleChange} className={allErrors.fecha_nacimiento ? 'input-error' : ''} />
                {allErrors.fecha_nacimiento && <span className="error-text">{allErrors.fecha_nacimiento}</span>}
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="telefono">Teléfono</label>
                  <input type="tel" id="telefono" name="telefono" value={formData.telefono} onChange={handleChange} onPaste={handlePaste} placeholder="0991234567" className={allErrors.telefono ? 'input-error' : ''} maxLength={10} inputMode="numeric" />
                  {allErrors.telefono && <span className="error-text">{allErrors.telefono}</span>}
                </div>
                <div className="form-group">
                  <label htmlFor="correo">Correo</label>
                  <input type="email" id="correo" name="correo" value={formData.correo} onChange={handleChange} onInvalid={(e) => e.preventDefault()} placeholder="email@example.com" className={allErrors.correo ? 'input-error' : ''} />
                  {allErrors.correo && <span className="error-text">{allErrors.correo}</span>}
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="direccion">Dirección</label>
                <input type="text" id="direccion" name="direccion" value={formData.direccion} onChange={handleChange} placeholder="Av. Principal 123" className={allErrors.direccion ? 'input-error' : ''} />
                {allErrors.direccion && <span className="error-text">{allErrors.direccion}</span>}
              </div>
            </>
          )}
          <div className="modal-footer">
            <button type="button" onClick={onClose} className={readOnly ? 'btn btn-secondary btn-detail-close' : 'btn btn-secondary btn-modal-cancel'}>{readOnly ? 'Cerrar' : 'Cancelar'}</button>
            {!readOnly && <button type="submit" className="btn btn-primary btn-modal-save" disabled={isLoading}>{isLoading ? 'Guardando...' : 'Guardar'}</button>}
          </div>
        </form>
      </div>
    </div>
  );
}
