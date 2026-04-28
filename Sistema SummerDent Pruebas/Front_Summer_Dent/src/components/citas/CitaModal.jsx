import { useMemo, useState } from 'react';

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
  const today = new Date().toISOString().slice(0, 10);
  return {
    id_paciente: initialData?.id_paciente ? String(initialData.id_paciente) : '',
    id_doctor: initialData?.id_doctor ? String(initialData.id_doctor) : '',
    tratamientos: getInitialTratamientoIds(initialData, tratamientos),
    fecha: initialData?.fecha ? String(initialData.fecha).split('T')[0] : today,
    hora_inicio: initialData?.hora_inicio || '',
    hora_fin: initialData?.hora_fin || '',
    precio: initialData?.precio !== undefined && initialData?.precio !== null ? String(initialData.precio) : '0.00',
    estado: initialData?.estado || 'pendiente'
  };
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
  const [formData, setFormData] = useState(() => getInitialFormData(initialData, tratamientos));
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

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.id_paciente) newErrors.id_paciente = 'Paciente requerido';
    if (!formData.id_doctor) newErrors.id_doctor = 'Odontólogo requerido';
    if (!Array.isArray(formData.tratamientos) || formData.tratamientos.length === 0) {
      newErrors.tratamientos = 'Debe seleccionar al menos un tratamiento';
    }
    if (!formData.fecha) newErrors.fecha = 'Fecha requerida';
    else {
      // bloquear fechas anteriores a hoy
      try {
        const today = new Date().toISOString().slice(0, 10);
        if (String(formData.fecha) < today) {
          newErrors.fecha = 'La fecha no puede ser anterior a hoy';
        }
      } catch {
        // ignore parsing errors, other validations will catch invalid formats
      }
    }
    if (!formData.hora_inicio) newErrors.hora_inicio = 'Hora inicio requerida';
    if (!formData.hora_fin) newErrors.hora_fin = 'Hora fin requerida';
    
    if (formData.hora_inicio && formData.hora_fin && formData.hora_inicio >= formData.hora_fin) {
      newErrors.hora_fin = 'Hora fin debe ser posterior a hora inicio';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    if (readOnly) return;
    const { name, value } = e.target;
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
    if (readOnly) return;
    setFormData((prev) => ({ ...prev, id_paciente: String(paciente.id_cedula) }));
    setPacienteQuery(formatPersonName(paciente));
    setIsPacienteOpen(false);
    if (displayErrors.id_paciente) {
      setErrors((prev) => ({ ...prev, id_paciente: '' }));
    }
  };

  const handleSelectDoctor = (doctor) => {
    if (readOnly) return;
    setFormData((prev) => ({ ...prev, id_doctor: String(doctor.id) }));
    setDoctorQuery(formatPersonName(doctor));
    setIsDoctorOpen(false);
    if (displayErrors.id_doctor) {
      setErrors((prev) => ({ ...prev, id_doctor: '' }));
    }
  };

  const toggleTratamiento = (tratamientoId) => {
    if (readOnly) return;

    const currentTratamientos = formData.tratamientos || [];
    const exists = currentTratamientos.some((id) => String(id) === String(tratamientoId));
    const nextTratamientos = exists
      ? currentTratamientos.filter((id) => String(id) !== String(tratamientoId))
      : [...currentTratamientos, String(tratamientoId)];

    setFormData((prev) => ({ ...prev, tratamientos: nextTratamientos }));

    if (displayErrors.tratamientos) {
      setErrors((prev) => ({ ...prev, tratamientos: '' }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (readOnly) return;
    if (validateForm()) {
      onSubmit({
        ...formData,
        id_doctor: Number(formData.id_doctor),
        tratamientos: (formData.tratamientos || []).map((id) => Number(id)),
        precio: Number(computedPrecio.toFixed(2))
      });
    }
  };

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
          <h2>{readOnly ? 'Ver Cita' : (initialData?.id ? 'Editar Cita' : 'Nueva Cita')}</h2>
          <button type="button" className="modal-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="cita-form">
          <div className="form-row" style={{display: 'flex', flexDirection: 'column', gap: '0.75rem'}}>
            <div className="form-group">
              {readOnly ? (
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
              {readOnly ? (
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
                    className={errors.fecha ? 'input-error' : ''}
                  />
                  {errors.fecha && <span className="error-text">{errors.fecha}</span>}

                  <label htmlFor="hora_inicio">Hora Inicio *</label>
                  <input
                    type="time"
                    id="hora_inicio"
                    name="hora_inicio"
                    value={formData.hora_inicio}
                    onChange={handleChange}
                    className={errors.hora_inicio ? 'input-error' : ''}
                  />
                  {errors.hora_inicio && <span className="error-text">{errors.hora_inicio}</span>}

                  <label htmlFor="hora_fin">Hora Fin *</label>
                  <input
                    type="time"
                    id="hora_fin"
                    name="hora_fin"
                    value={formData.hora_fin}
                    onChange={handleChange}
                    className={errors.hora_fin ? 'input-error' : ''}
                  />
                  {errors.hora_fin && <span className="error-text">{errors.hora_fin}</span>}
                </>
              )}
            </div>
          </div>

          <div className="form-row" style={{display: 'flex', flexDirection: 'column', gap: '0.75rem'}}>
            <div className="form-group">
              {readOnly ? (
                <>
                  <ReadRow label="Tratamiento:" value={getTratamientosLabel(tratamientos, formData.tratamientos)} />
                  <ReadRow label="Monto:" value={`$${Number(formData.precio || computedPrecio).toFixed(2)}`} />
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
                    value={computedPrecio.toFixed(2)}
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    readOnly
                  />

                  <label htmlFor="estado">Estado</label>
                  <select
                    id="estado"
                    name="estado"
                    value={formData.estado}
                    onChange={handleChange}
                  >
                    <option value="pendiente">Pendiente</option>
                    <option value="confirmada">Confirmada</option>
                    <option value="Atendida">Atendida</option>
                    <option value="cancelada">Cancelada</option>
                  </select>
                </>
              )}
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              {readOnly ? 'Cerrar' : 'Cancelar'}
            </button>
            {!readOnly && (
              <button type="submit" className="btn btn-primary" disabled={isLoading}>
                {isLoading ? 'Guardando...' : 'Guardar'}
              </button>
            )}
          </div>
        </form>

        {!readOnly && isTratamientoSelectorOpen && (
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
                  <button type="button" className="btn btn-secondary" onClick={() => setIsTratamientoSelectorOpen(false)}>
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
