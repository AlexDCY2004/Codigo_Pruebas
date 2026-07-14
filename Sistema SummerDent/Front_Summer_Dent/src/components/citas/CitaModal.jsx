import { useEffect, useMemo, useState } from 'react';
import { checkDisponibilidad } from '../../services/api/citas';

const normalizeText = (value) => String(value || '').trim().toLowerCase();

const formatPersonName = (obj) => {
  if (!obj) return '-';
  const parts = [];
  if (obj.nombre) parts.push(String(obj.nombre).trim());
  if (obj.apellido) parts.push(String(obj.apellido).trim());
  const joined = parts.join(' ').trim();
  return joined || (obj.nombre ? String(obj.nombre).trim() : (obj.apellido ? String(obj.apellido).trim() : '-'));
};

const formatCurrency = (value) => {
  const number = Number(value || 0);
  return new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(
    Number.isFinite(number) ? number : 0
  );
};

const getInitialTratamientoIds = (initialData, tratamientos) => {
  if (!initialData) return [];

  const ids = new Set();

  if (Array.isArray(initialData.tratamientos)) {
    initialData.tratamientos.forEach((item) => {
      if (item && typeof item === 'object' && item.id) ids.add(String(item.id));
      else if (item && /^\d+$/.test(String(item))) ids.add(String(item));
    });
  }

  if (initialData.id_tratamiento && /^\d+$/.test(String(initialData.id_tratamiento))) {
    ids.add(String(initialData.id_tratamiento));
  }

  if (typeof initialData.tratamientos === 'string' && initialData.tratamientos.trim()) {
    const names = initialData.tratamientos
      .split(',')
      .map((name) => normalizeText(name))
      .filter(Boolean);

    names.forEach((name) => {
      const found = (tratamientos || []).find((tratamiento) => normalizeText(tratamiento.nombre) === name);
      if (found?.id) ids.add(String(found.id));
    });
  }

  return [...ids];
};

const getInitialFormData = (initialData, tratamientos) => {
  // Use local date (YYYY-MM-DD) to avoid timezone shifts when converting to ISO
  const getLocalDateYYYYMMDD = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const today = getLocalDateYYYYMMDD();
  return {
    id_paciente: initialData?.id_paciente ? String(initialData.id_paciente) : '',
    id_doctor: initialData?.id_doctor ? String(initialData.id_doctor) : '',
    tratamientos: getInitialTratamientoIds(initialData, tratamientos),
    fecha: initialData?.fecha ? String(initialData.fecha).split('T')[0] : today,
    hora_inicio: initialData?.hora_inicio || '',
    hora_fin: initialData?.hora_fin || '',
    precio: initialData?.precio !== undefined && initialData?.precio !== null ? String(initialData.precio) : '',
    estado: initialData?.estado || 'agendada'
  };
};

// Allowed schedule window for appointments
const OPEN_TIME = '08:00';
const CLOSE_TIME = '20:00';

const getLocalDateYYYYMMDD = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getDateOffsetMonths = (months) => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setMonth(date.getMonth() + months);
  return getLocalDateYYYYMMDD(date);
};

const getCitaDateWindow = () => ({
  minDate: getDateOffsetMonths(0),
  maxDate: getDateOffsetMonths(2)
});

const isFechaCitaWithinWindow = (fecha) => {
  if (!fecha) return false;
  const value = String(fecha).split('T')[0];
  const { minDate, maxDate } = getCitaDateWindow();
  return value >= minDate && value <= maxDate;
};

const getInitialPacienteQuery = (initialData, pacientes) => {
  if (!initialData?.id_paciente) return '';
  const found = (pacientes || []).find((item) => String(item.id_cedula) === String(initialData.id_paciente));
  return found ? formatPersonName(found) : '';
};

const getInitialDoctorQuery = (initialData, doctores) => {
  if (!initialData?.id_doctor) return '';
  const found = (doctores || []).find((item) => String(item.id) === String(initialData.id_doctor));
  return found ? formatPersonName(found) : '';
};

function ReadRow({ label, value }) {
  return (
    <div className="field-row">
      <div className="field-label">{label}</div>
      <div className="field-value">{value ?? '-'}</div>
    </div>
  );
}

export default function CitaModal({ isOpen, onClose, onSubmit, initialData, isLoading, pacientes = [], doctores = [], tratamientos = [], readOnly = false, externalErrors = {} }) {
  const isReadOnly = readOnly || String(initialData?.estado || '').toLowerCase() === 'atendida';
  const [formData, setFormData] = useState(() => getInitialFormData(initialData, tratamientos));
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isPrecioEdited, setIsPrecioEdited] = useState(() => {
    return initialData?.precio !== undefined && initialData?.precio !== null;
  });
  const [paymentMethod, setPaymentMethod] = useState('efectivo');
  const [paymentDetail, setPaymentDetail] = useState('');
  const [paymentErrors, setPaymentErrors] = useState({});
  const [prevEstado, setPrevEstado] = useState(formData.estado);
  const [pacienteQuery, setPacienteQuery] = useState(() => getInitialPacienteQuery(initialData, pacientes));
  const [doctorQuery, setDoctorQuery] = useState(() => getInitialDoctorQuery(initialData, doctores));
  const [isPacienteOpen, setIsPacienteOpen] = useState(false);
  const [isDoctorOpen, setIsDoctorOpen] = useState(false);
  const [isTratamientoSelectorOpen, setIsTratamientoSelectorOpen] = useState(false);
  const [tratamientoSelectorSearch, setTratamientoSelectorSearch] = useState('');

  const [errors, setErrors] = useState({});

  // Avoid synchronous setState in effects (parent uses `key` to remount modal when needed).
  // Use a merged view of local + external errors for rendering without forcing state updates here.
  const displayErrors = { ...(errors || {}), ...(externalErrors || {}) };

  const computedPrecio = useMemo(() => {
    return (formData.tratamientos || []).reduce((acc, tratamientoId) => {
      const found = tratamientos.find((item) => String(item.id) === String(tratamientoId));
      return acc + Number(found?.precio || 0);
    }, 0);
  }, [formData.tratamientos, tratamientos]);

  // Nota: no sincronizamos formData.precio vía setState para evitar renders
  // encadenados. En lugar de ello, el input mostrará el `computedPrecio` cuando
  // el usuario no haya editado manualmente el precio.

  const filteredPacientes = useMemo(() => {
    const query = normalizeText(pacienteQuery);
    return pacientes.filter((paciente) => {
      const name = formatPersonName(paciente);
      const cedula = String(paciente.id_cedula || '');
      return !query || normalizeText(name).includes(query) || normalizeText(cedula).includes(query);
    });
  }, [pacienteQuery, pacientes]);

  const filteredDoctores = useMemo(() => {
    const query = normalizeText(doctorQuery);
    return doctores.filter((doctor) => {
      const name = formatPersonName(doctor);
      const especialidad = String(doctor.especialidad || '');
      return !query || normalizeText(name).includes(query) || normalizeText(especialidad).includes(query);
    });
  }, [doctorQuery, doctores]);

  const groupedTratamientos = useMemo(() => {
    const query = normalizeText(tratamientoSelectorSearch);
    const filtered = tratamientos.filter((tratamiento) => {
      if (!query) return true;
      const area = String(tratamiento.area || '');
      const name = String(tratamiento.nombre || '');
      const description = String(tratamiento.descripcion || '');
      return normalizeText(area).includes(query)
        || normalizeText(name).includes(query)
        || normalizeText(description).includes(query);
    });

    return filtered.reduce((acc, tratamiento) => {
      const area = tratamiento.area || 'Sin área';
      if (!acc[area]) acc[area] = [];
      acc[area].push(tratamiento);
      return acc;
    }, {});
  }, [tratamientoSelectorSearch, tratamientos]);

  const selectedTratamientosText = useMemo(() => {
    if (!Array.isArray(formData.tratamientos) || formData.tratamientos.length === 0) return '';

    const names = formData.tratamientos
      .map((id) => tratamientos.find((item) => String(item.id) === String(id))?.nombre)
      .filter(Boolean);

    return names.join(', ');
  }, [formData.tratamientos, tratamientos]);

  const findAndFormat = (list, id) => {
    if (!list || !id) return '-';
    const item = list.find((x) => String(x.id ?? x.id_cedula) === String(id));
    if (!item) return String(id);
    return formatPersonName(item) || String(id);
  };

  const getTratamientosLabel = (list, tratamientoIds = []) => {
    if (!Array.isArray(tratamientoIds) || tratamientoIds.length === 0) return '-';
    const names = tratamientoIds
      .map((id) => list.find((item) => String(item.id) === String(id))?.nombre)
      .filter(Boolean);
    return names.length ? names.join(', ') : '-';
  };

  const getTratamientoPrecio = (tratamientoId) => {
    const found = tratamientos.find((item) => String(item.id) === String(tratamientoId));
    const precio = Number(found?.precio || 0);
    return Number.isFinite(precio) ? precio : 0;
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.id_paciente) newErrors.id_paciente = 'Paciente requerido';
    if (!formData.id_doctor) newErrors.id_doctor = 'Odontólogo requerido';
    if (!Array.isArray(formData.tratamientos) || formData.tratamientos.length === 0) {
      newErrors.tratamientos = 'Debe seleccionar al menos un tratamiento';
    }
    if (!formData.fecha) newErrors.fecha = 'Fecha requerida';
    else {
      // bloquear fechas fuera de la ventana permitida: desde hoy hasta 2 meses
      try {
        const { minDate, maxDate } = getCitaDateWindow();
        const fechaValue = String(formData.fecha).split('T')[0];

        if (fechaValue < minDate) {
          newErrors.fecha = 'La fecha no puede ser anterior a hoy';
        } else if (fechaValue > maxDate) {
          newErrors.fecha = `La fecha no puede superar ${maxDate} (máximo 2 meses)`;
        }
      } catch {
        // ignore parsing errors, other validations will catch invalid formats
      }
    }
    if (!formData.hora_inicio) newErrors.hora_inicio = 'Hora inicio requerida';
    if (!formData.hora_fin) newErrors.hora_fin = 'Hora fin requerida';

    // validate within allowed schedule window
    if (formData.hora_inicio) {
      if (String(formData.hora_inicio) < OPEN_TIME || String(formData.hora_inicio) > CLOSE_TIME) {
        newErrors.hora_inicio = `La hora de inicio debe estar entre ${OPEN_TIME} y ${CLOSE_TIME}`;
      }
    }
    if (formData.hora_fin) {
      if (String(formData.hora_fin) < OPEN_TIME || String(formData.hora_fin) > CLOSE_TIME) {
        newErrors.hora_fin = `La hora de fin debe estar entre ${OPEN_TIME} y ${CLOSE_TIME}`;
      }
    }

    if (formData.hora_inicio && formData.hora_fin && formData.hora_inicio >= formData.hora_fin) {
      newErrors.hora_fin = 'Hora fin debe ser posterior a hora inicio';
    }

    // precio editable: validar hasta 4 dígitos y 2 decimales
    if (isPrecioEdited) {
      const precioVal = String(formData.precio ?? '').trim();
      if (!/^[0-9]{1,4}(\.[0-9]{1,2})?$/.test(precioVal)) {
        newErrors.precio = 'El precio debe tener hasta 4 dígitos y hasta 2 decimales';
      } else if (Number(precioVal) < 0) {
        newErrors.precio = 'El precio debe ser mayor o igual a 0';
      } else if (Number(precioVal) > 9999.99) {
        newErrors.precio = 'El precio no puede ser mayor a 9999.99';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const checkHorarioDisponible = async () => {
    const idDoctor = formData.id_doctor;
    const fecha = formData.fecha;
    const horaInicio = formData.hora_inicio;
    const horaFin = formData.hora_fin;
    if (!idDoctor || !fecha || !horaInicio || !horaFin) return true;
    try {
      const result = await checkDisponibilidad({
        idDoctor,
        fecha,
        horaInicio,
        horaFin,
        exclude: initialData?.id || undefined
      });
      if (!result.disponible) {
        setErrors((prev) => ({
          ...prev,
          _form: `El horario se solapa con otra cita (${result.conflictoCon.hora_inicio} - ${result.conflictoCon.hora_fin})`
        }));
        return false;
      }
      setErrors((prev) => {
        const next = { ...prev };
        delete next._form;
        return next;
      });
      return true;
    } catch (error) {
      const serverMessage = error?.response?.data?.error || error?.message || 'No se pudo verificar la disponibilidad';
      if (error?.response?.status === 409) {
        setErrors((prev) => ({
          ...prev,
          _form: serverMessage
        }));
        return false;
      }

      return true;
    }
  };

  useEffect(() => {
    if (isReadOnly) return undefined;

    const hasAvailabilityFields = formData.id_doctor && formData.fecha && formData.hora_inicio && formData.hora_fin;
    if (!hasAvailabilityFields) {
      setErrors((prev) => {
        if (!prev._form) return prev;
        const next = { ...prev };
        delete next._form;
        return next;
      });
      return undefined;
    }

    const timer = setTimeout(() => {
      checkHorarioDisponible();
    }, 250);

    return () => clearTimeout(timer);
  }, [formData.id_doctor, formData.fecha, formData.hora_inicio, formData.hora_fin, isReadOnly]);

  const validateField = (fieldName) => {
    const newErrors = { ...(errors || {}) };

    if (fieldName === 'fecha') {
      if (!formData.fecha) newErrors.fecha = 'Fecha requerida';
      else {
        try {
          const { minDate, maxDate } = getCitaDateWindow();
          const fechaValue = String(formData.fecha).split('T')[0];

          if (fechaValue < minDate) {
            newErrors.fecha = 'La fecha no puede ser anterior a hoy';
          } else if (fechaValue > maxDate) {
            newErrors.fecha = `La fecha no puede superar ${maxDate} (máximo 2 meses)`;
          } else {
            delete newErrors.fecha;
          }
        } catch {
          newErrors.fecha = 'Fecha inválida';
        }
      }
    }

    if (fieldName === 'hora_inicio' || fieldName === 'hora_fin') {
      const start = formData.hora_inicio;
      const end = formData.hora_fin;

      if (fieldName === 'hora_inicio') {
        if (!start) newErrors.hora_inicio = 'Hora inicio requerida';
        else if (String(start) < OPEN_TIME || String(start) > CLOSE_TIME) newErrors.hora_inicio = `La hora de inicio debe estar entre ${OPEN_TIME} y ${CLOSE_TIME}`;
        else delete newErrors.hora_inicio;
      }

      if (fieldName === 'hora_fin') {
        if (!end) newErrors.hora_fin = 'Hora fin requerida';
        else if (String(end) < OPEN_TIME || String(end) > CLOSE_TIME) newErrors.hora_fin = `La hora de fin debe estar entre ${OPEN_TIME} y ${CLOSE_TIME}`;
        else delete newErrors.hora_fin;
      }

      if (start && end && start >= end) {
        newErrors.hora_fin = 'Hora fin debe ser posterior a hora inicio';
      }
    }

    if (fieldName === 'precio') {
      if (isPrecioEdited) {
        const precioVal = String(formData.precio ?? '').trim();
        if (!/^[0-9]{1,4}(\.[0-9]{1,2})?$/.test(precioVal)) {
          newErrors.precio = 'El precio puede tener hasta 4 dígitos y hasta 2 decimales';
        } else if (Number(precioVal) < 0) {
          newErrors.precio = 'El precio debe ser mayor o igual a 0';
        } else if (Number(precioVal) > 9999.99) {
          newErrors.precio = 'El precio no puede ser mayor a 9999.99';
        } else {
          delete newErrors.precio;
        }
      } else {
        delete newErrors.precio;
      }
    }

    setErrors(newErrors);
    if ((fieldName === 'fecha' || fieldName === 'hora_inicio' || fieldName === 'hora_fin') && !newErrors.fecha && !newErrors.hora_inicio && !newErrors.hora_fin) {
      checkHorarioDisponible();
    }
  };

  const handleChange = (e) => {
    if (isReadOnly) return;
    const { name, value } = e.target;
    // Si el usuario cambia el estado a 'Atendida' y la cita no estaba ya atendida,
    // abrimos inmediatamente el modal de pago antes de guardar.
    if (name === 'estado' && String(value) === 'Atendida') {
      const wasAttended = initialData && String(initialData.estado) === 'Atendida';
      if (!wasAttended && String(formData.estado) !== 'Atendida') {
        setPrevEstado(String(formData.estado || 'agendada'));
        // preasignar estado pero esperar confirmación de pago
        setFormData(prev => ({ ...prev, [name]: value }));
        setPaymentMethod('efectivo');
        setPaymentDetail('');
        setPaymentErrors({});
        setIsPaymentModalOpen(true);
        return;
      }
    }

    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (displayErrors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleSelectPaciente = (paciente) => {
    if (isReadOnly) return;
    setFormData((prev) => ({ ...prev, id_paciente: String(paciente.id_cedula) }));
    setPacienteQuery(formatPersonName(paciente));
    setIsPacienteOpen(false);
    if (displayErrors.id_paciente) {
      setErrors((prev) => ({ ...prev, id_paciente: '' }));
    }
  };

  const handleSelectDoctor = (doctor) => {
    if (isReadOnly) return;
    setFormData((prev) => ({ ...prev, id_doctor: String(doctor.id) }));
    setDoctorQuery(formatPersonName(doctor));
    setIsDoctorOpen(false);
    if (displayErrors.id_doctor) {
      setErrors((prev) => ({ ...prev, id_doctor: '' }));
    }
  };

  const toggleTratamiento = (tratamientoId) => {
    if (isReadOnly) return;

    const currentTratamientos = formData.tratamientos || [];
    const exists = currentTratamientos.some((id) => String(id) === String(tratamientoId));
    const nextTratamientos = exists
      ? currentTratamientos.filter((id) => String(id) !== String(tratamientoId))
      : [...currentTratamientos, String(tratamientoId)];

    const currentMonto = formData.precio !== undefined && formData.precio !== ''
      ? Number(formData.precio)
      : (currentTratamientos || []).reduce((acc, id) => acc + getTratamientoPrecio(id), 0);

    const deltaMonto = exists
      ? -getTratamientoPrecio(tratamientoId)
      : getTratamientoPrecio(tratamientoId);

    const nextMonto = Math.max(0, Number((currentMonto + deltaMonto).toFixed(2)));

    setFormData((prev) => ({
      ...prev,
      tratamientos: nextTratamientos,
      precio: String(nextMonto)
    }));
    setIsPrecioEdited(true);

    if (displayErrors.tratamientos) {
      setErrors((prev) => ({ ...prev, tratamientos: '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isReadOnly) return;
    if (!validateForm()) return;
    const disponible = await checkHorarioDisponible();
    if (!disponible) return;
    // Si cambia a Atendida desde otro estado y aún no tenemos metodo_pago, abrir modal
    const willAttend = String(formData.estado) === 'Atendida';
    const wasAttended = initialData && String(initialData.estado) === 'Atendida';

    if (willAttend && !wasAttended && !(formData.metodo_pago || paymentMethod)) {
      setPaymentErrors({});
      // Si aún no se han completado los datos de pago mostramos la sección inline
      setIsPaymentModalOpen(true);
      return;
    }

    onSubmit({
      ...formData,
      id_doctor: Number(formData.id_doctor),
      tratamientos: (formData.tratamientos || []).map((id) => Number(id)),
      precio: Number(Number((formData.precio !== undefined && formData.precio !== '') ? formData.precio : computedPrecio).toFixed(2)),
      metodo_pago: formData.metodo_pago || paymentMethod,
      detalle_pago: formData.detalle_pago || paymentDetail
    });
  };

  // Nota: la sección de pago ahora está integrada inline en el modal; los valores
  // se sincronizan con `paymentMethod`/`paymentDetail` y se incluyen al enviar.

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content modal-content--large" onClick={(e) => e.stopPropagation()}>
        {displayErrors._form && (
          <div style={{ padding: '0 1.25rem', marginTop: '0.75rem' }}>
            <div className="alert alert-error">{displayErrors._form}</div>
          </div>
        )}
        <div className="modal-header">
          <h2>{isReadOnly ? 'Ver Cita' : (initialData?.id ? 'Editar Cita' : 'Nueva Cita')}</h2>
          <button type="button" className="modal-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="cita-form" noValidate onInvalid={(e) => e.preventDefault()}>
          <div className="form-row" style={{display: 'flex', flexDirection: 'column', gap: '0.75rem'}}>
            <div className="form-group">
              {isReadOnly ? (
                <>
                  <ReadRow label="Nombre:" value={findAndFormat(pacientes, formData.id_paciente)} />
                  <ReadRow label="Odontólogo:" value={findAndFormat(doctores, formData.id_doctor)} />
                </>
              ) : (
                <>
                  <label htmlFor="id_paciente">Paciente *</label>
                  <div className={`searchable-combobox ${displayErrors.id_paciente ? 'input-error' : ''}`}>
                    <input
                      id="id_paciente"
                      name="id_paciente"
                      type="text"
                      value={pacienteQuery}
                      onFocus={() => setIsPacienteOpen(true)}
                      onBlur={() => setTimeout(() => setIsPacienteOpen(false), 120)}
                      onChange={(event) => {
                        setPacienteQuery(event.target.value);
                        setIsPacienteOpen(true);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') event.preventDefault();
                      }}
                      placeholder="Escribe para filtrar paciente"
                      autoComplete="off"
                    />
                    {isPacienteOpen && (
                      <div className="searchable-combobox-list" role="listbox" aria-label="Listado de pacientes">
                        {filteredPacientes.slice(0, 8).map((paciente) => (
                          <button
                            key={paciente.id_cedula}
                            type="button"
                            className={`searchable-option ${String(formData.id_paciente) === String(paciente.id_cedula) ? 'is-selected' : ''}`}
                            onMouseDown={(event) => {
                              event.preventDefault();
                              handleSelectPaciente(paciente);
                            }}
                          >
                            <span>{formatPersonName(paciente)}</span>
                            <small>{paciente.id_cedula}</small>
                          </button>
                        ))}
                        {filteredPacientes.length === 0 && (
                          <div className="searchable-empty">No hay pacientes que coincidan</div>
                        )}
                      </div>
                    )}
                  </div>
                  {errors.id_paciente && <span className="error-text">{errors.id_paciente}</span>}

                  <label htmlFor="id_doctor">Odontólogo *</label>
                  <div className={`searchable-combobox ${displayErrors.id_doctor ? 'input-error' : ''}`}>
                    <input
                      id="id_doctor"
                      name="id_doctor"
                      type="text"
                      value={doctorQuery}
                      onFocus={() => setIsDoctorOpen(true)}
                      onBlur={() => setTimeout(() => setIsDoctorOpen(false), 120)}
                      onChange={(event) => {
                        setDoctorQuery(event.target.value);
                        setIsDoctorOpen(true);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') event.preventDefault();
                      }}
                      placeholder="Escribe para filtrar odontólogo"
                      autoComplete="off"
                    />
                    {isDoctorOpen && (
                      <div className="searchable-combobox-list" role="listbox" aria-label="Listado de odontologos">
                        {filteredDoctores.slice(0, 8).map((doctor) => (
                          <button
                            key={doctor.id}
                            type="button"
                            className={`searchable-option ${String(formData.id_doctor) === String(doctor.id) ? 'is-selected' : ''}`}
                            onMouseDown={(event) => {
                              event.preventDefault();
                              handleSelectDoctor(doctor);
                            }}
                          >
                            <span>{formatPersonName(doctor)}</span>
                            <small>{doctor.especialidad || '-'}</small>
                          </button>
                        ))}
                        {filteredDoctores.length === 0 && (
                          <div className="searchable-empty">No hay odontólogos que coincidan</div>
                        )}
                      </div>
                    )}
                  </div>
                  {errors.id_doctor && <span className="error-text">{errors.id_doctor}</span>}
                </>
              )}
            </div>
          </div>

          <div className="form-row" style={{display: 'flex', flexDirection: 'column', gap: '0.75rem'}}>
            <div className="form-group">
              {isReadOnly ? (
                <>
                  <ReadRow label="Fecha:" value={formData.fecha || '-'} />
                  <ReadRow label="Hora Inicio:" value={formData.hora_inicio || '-'} />
                  <ReadRow label="Hora Fin:" value={formData.hora_fin || '-'} />
                </>
              ) : (
                <>
                  <label htmlFor="fecha">Fecha *</label>
                  <input
                    type="date"
                    id="fecha"
                    name="fecha"
                    value={formData.fecha}
                    onChange={handleChange}
                    onBlur={() => validateField('fecha')}
                    className={errors.fecha ? 'input-error' : ''}
                    min={getCitaDateWindow().minDate}
                    max={getCitaDateWindow().maxDate}
                  />
                  {errors.fecha && <span className="error-text">{errors.fecha}</span>}

                  <label htmlFor="hora_inicio">Hora Inicio *</label>
                  <input
                    type="time"
                    id="hora_inicio"
                    name="hora_inicio"
                    value={formData.hora_inicio}
                    onChange={handleChange}
                    onBlur={() => validateField('hora_inicio')}
                    className={errors.hora_inicio ? 'input-error' : ''}
                    min={OPEN_TIME}
                    max={CLOSE_TIME}
                  />
                  {errors.hora_inicio && <span className="error-text">{errors.hora_inicio}</span>}

                  <label htmlFor="hora_fin">Hora Fin *</label>
                  <input
                    type="time"
                    id="hora_fin"
                    name="hora_fin"
                    value={formData.hora_fin}
                    onChange={handleChange}
                    onBlur={() => validateField('hora_fin')}
                    className={errors.hora_fin ? 'input-error' : ''}
                    min={OPEN_TIME}
                    max={CLOSE_TIME}
                  />
                  {errors.hora_fin && <span className="error-text">{errors.hora_fin}</span>}
                </>
              )}
            </div>
          </div>

          <div className="form-row" style={{display: 'flex', flexDirection: 'column', gap: '0.75rem'}}>
            <div className="form-group">
              {isReadOnly ? (
                <>
                  <ReadRow label="Tratamiento:" value={getTratamientosLabel(tratamientos, formData.tratamientos)} />
                  <ReadRow label="Monto:" value={formatCurrency(formData.precio || computedPrecio)} />
                  <ReadRow label="Estado:" value={formData.estado || '-'} />
                </>
              ) : (
                <>
                  <label htmlFor="tratamientos">Tratamientos *</label>
                  <button
                    type="button"
                    id="tratamientos"
                    className={`searchable-combobox searchable-combobox--button ${displayErrors.tratamientos ? 'input-error' : ''}`}
                    onClick={() => setIsTratamientoSelectorOpen(true)}
                  >
                    <span className={`searchable-combobox__value ${selectedTratamientosText ? '' : 'is-placeholder'}`}>
                      {selectedTratamientosText || 'Seleccionar tratamiento(s)'}
                    </span>
                    <span className="searchable-combobox__icon">▾</span>
                  </button>
                  {errors.tratamientos && <span className="error-text">{errors.tratamientos}</span>}

                  <label htmlFor="precio">Monto</label>
                  <input
                    type="number"
                    id="precio"
                    name="precio"
                    value={isPrecioEdited ? formData.precio : computedPrecio.toFixed(2)}
                    step="0.01"
                    min="0"
                    max="9999.99"
                    placeholder="0.00"
                    onChange={(e) => {
                      const v = e.target.value;
                      // marcar como editado sólo si el usuario dejó un valor no vacío
                      setIsPrecioEdited(String(v).trim() !== '');
                      setFormData((prev) => ({ ...prev, precio: v }));
                      if (displayErrors.precio) {
                        setErrors((prev) => ({ ...prev, precio: '' }));
                      }
                    }}
                    onBlur={() => validateField('precio')}
                  />
                  {errors.precio && <span className="error-text">{errors.precio}</span>}

                  <label htmlFor="estado">Estado</label>
                  <select
                    id="estado"
                    name="estado"
                    value={formData.estado}
                    onChange={handleChange}
                  >
                    <option value="agendada">Agendada</option>
                    <option value="confirmada">Confirmada</option>
                    <option value="Atendida">Atendida</option>
                    <option value="cancelada">Cancelada</option>
                  </select>
                  {/* Mostrar sección de pago directamente debajo del campo Estado cuando corresponde */}
                  {!isReadOnly && isPaymentModalOpen && (
                    <div className="payment-section" style={{ padding: '1rem', border: '1px solid #eee', borderRadius: '6px', marginTop: '0.75rem' }}>
                      <h3 style={{ margin: 0, marginBottom: '0.5rem' }}>Registrar pago</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <div className="form-group">
                          <label htmlFor="metodo_pago">Método de pago</label>
                          <select id="metodo_pago" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} style={{ width: '100%', padding: '0.5rem' }}>
                            <option value="efectivo">Efectivo</option>
                            <option value="transferencia">Transferencia</option>
                            <option value="deposito">Depósito bancario</option>
                            <option value="tarjeta">Tarjeta</option>
                          </select>
                          {paymentErrors.metodo && <span className="error-text">{paymentErrors.metodo}</span>}
                        </div>

                        <div className="form-group">
                          <label htmlFor="detalle_pago">Detalle</label>
                          <textarea id="detalle_pago" rows={3} value={paymentDetail} onChange={(e) => setPaymentDetail(e.target.value)} placeholder="Descripción breve del pago (opcional)" style={{ width: '100%', padding: '0.5rem' }} />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                          {/* Eliminado el botón "Cancelar pago" por petición del usuario; el usuario usa el botón "Guardar" del modal */}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" onClick={() => {
              // revertir estado y campos de pago al cancelar el modal
              setFormData((prev) => ({ ...prev, estado: prevEstado, metodo_pago: undefined, detalle_pago: undefined }));
              setPaymentMethod('efectivo');
              setPaymentDetail('');
              setPaymentErrors({});
              onClose();
            }} className={isReadOnly ? 'btn btn-secondary btn-detail-close' : 'btn btn-secondary btn-modal-cancel'}>
              {isReadOnly ? 'Cerrar' : 'Cancelar'}
            </button>
            {!isReadOnly && (
              <button type="submit" className="btn btn-primary btn-modal-save" disabled={isLoading}>
                {isLoading ? 'Guardando...' : 'Guardar'}
              </button>
            )}
          </div>
        </form>

        {/* payment section moved to appear below Estado select */}

        {!isReadOnly && isTratamientoSelectorOpen && (
          <div className="modal-overlay modal-overlay--nested" onClick={() => setIsTratamientoSelectorOpen(false)}>
            <div className="modal-content modal-content--selector" onClick={(event) => event.stopPropagation()}>
              <div className="modal-header">
                <h2>Seleccionar Tratamientos</h2>
                <button type="button" className="modal-close" onClick={() => setIsTratamientoSelectorOpen(false)}>✕</button>
              </div>

              <div className="tratamientos-selector-modal">
                <div className="search-container tratamientos-selector-search">
                  <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.35-4.35" />
                  </svg>
                  <input
                    type="text"
                    className="search-input"
                    placeholder="Buscar por nombre, área o descripción..."
                    value={tratamientoSelectorSearch}
                    onChange={(event) => setTratamientoSelectorSearch(event.target.value)}
                  />
                </div>

                <div className="tratamientos-selector-grid">
                  {Object.keys(groupedTratamientos).length === 0 ? (
                    <div className="empty-state tratamientos-selector-empty">
                      <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🧾</div>
                      <h3>No hay tratamientos que coincidan</h3>
                      <p>Prueba con otro término de búsqueda.</p>
                    </div>
                  ) : (
                    Object.entries(groupedTratamientos).map(([area, items]) => (
                      <section key={area} className="tratamientos-selector-group">
                        <div className="tratamientos-selector-group__header">
                          <h3>{area}</h3>
                          <span>{items.length}</span>
                        </div>

                        <div className="tratamientos-selector-list">
                          {items.map((tratamiento) => {
                            const checked = (formData.tratamientos || []).some((id) => String(id) === String(tratamiento.id));

                            return (
                              <button
                                key={tratamiento.id}
                                type="button"
                                className={`tratamientos-selector-item ${checked ? 'is-selected' : ''}`}
                                onClick={() => toggleTratamiento(tratamiento.id)}
                              >
                                <div className="tratamientos-selector-item__main">
                                  <input type="checkbox" checked={checked} readOnly />
                                  <div>
                                    <strong>{tratamiento.nombre}</strong>
                                    <p>{tratamiento.descripcion || 'Sin descripción'}</p>
                                  </div>
                                </div>
                                <span className="tratamientos-selector-item__price">{formatCurrency(tratamiento.precio)}</span>
                              </button>
                            );
                          })}
                        </div>
                      </section>
                    ))
                  )}
                </div>

                <div className="modal-footer tratamientos-selector-footer">
                  <div className="tratamientos-selector-summary">
                    {formData.tratamientos.length > 0
                      ? `${formData.tratamientos.length} tratamiento(s) seleccionados`
                      : 'Selecciona uno o varios tratamientos'}
                  </div>
                  <button type="button" className="btn btn-secondary btn-modal-cancel" onClick={() => setIsTratamientoSelectorOpen(false)}>
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
