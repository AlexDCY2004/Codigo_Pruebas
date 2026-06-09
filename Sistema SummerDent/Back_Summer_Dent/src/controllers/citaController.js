import { getSupabaseClientWithToken, supabase, supabaseAdmin } from '../configuracionesDB/supabaseClient.js';
import { actualizarTotalesCajaParaPeriodo, normalizeMetodoPago } from './movimientoFinanzasController.js';
import { getPerfilFromToken } from '../utils/perfilUtils.js';
import { getAuthTokenFromReq } from '../utils/authUtils.js';

const estadosPermitidos = ['agendada', 'confirmada', 'Atendida', 'cancelada'];

const esEnteroPositivo = (v) => /^\d+$/.test(String(v || '').trim()) && Number(String(v).trim()) > 0;
const esCedulaValida = (cedula) => {
  if (typeof cedula !== 'string' && typeof cedula !== 'number') return false;
  const limpia = String(cedula).trim();
  if (!/^\d{6,11}$/.test(limpia)) return false;
  return true;
};

const esFechaValida = (f) => typeof f === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(f) && !Number.isNaN(new Date(`${f}T00:00:00`).getTime());
const esHoraValida = (h) => typeof h === 'string' && /^\d{2}:\d{2}(:\d{2})?$/.test(h);

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
  minDate: getDateOffsetMonths(-2),
  maxDate: getDateOffsetMonths(3)
});

const esFechaCitaDentroDeVentana = (fecha) => {
  if (!esFechaValida(fecha)) return false;
  const value = String(fecha).slice(0, 10);
  const { minDate, maxDate } = getCitaDateWindow();
  return value >= minDate && value <= maxDate;
};
const decodificarJwtPayload = (token) => {
  if (!token || typeof token !== 'string') return null;
  const partes = token.split('.');
  if (partes.length < 2) return null;
  const base64 = partes[1].replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
};

const obtenerPerfilIdDesdeToken = (token) => {
  try {
    const payload = decodificarJwtPayload(token);
    return payload && payload.sub ? String(payload.sub) : null;
  } catch (e) {
    return null;
  }
};

const obtenerPerfilIdAutenticado = async (token, supabaseUser) => {
  // Camino principal: validar token explícitamente en Supabase (más confiable en backend).
  try {
    const {
      data: { user },
      error
    } = await supabase.auth.getUser(token);
    if (!error && user && user.id) return String(user.id);
  } catch (e) {}

  // Fallback: cliente con Authorization header.
  try {
    const { data: userData } = await supabaseUser.auth.getUser();
    if (userData && userData.user && userData.user.id) return String(userData.user.id);
    if (userData && userData.id) return String(userData.id);
  } catch (e) {}

  // Último fallback: decodificar JWT localmente.
  return obtenerPerfilIdDesdeToken(token);
};

export const crearCitaController = async (req, res) => {
  try {
    const token = getAuthTokenFromReq(req);
    if (!token) return res.status(401).json({ error: 'Token no proporcionado' });
    const supabaseUser = getSupabaseClientWithToken(token);

    const { id_paciente, id_doctor, id_tratamiento, tratamientos, id_perfil, fecha, hora_inicio, hora_fin, precio, estado } = req.body;

    if (typeof req.body !== 'object' || req.body === null || Array.isArray(req.body)) {
      return res.status(400).json({ error: 'El cuerpo de la solicitud debe ser un objeto JSON valido' });
    }

    if (!id_paciente || !id_doctor || !fecha || !hora_inicio || !hora_fin) {
      return res.status(400).json({ error: 'id_paciente, id_doctor, fecha, hora_inicio y hora_fin son requeridos' });
    }

    if (!esCedulaValida(id_paciente)) return res.status(400).json({ error: 'id_paciente inválido' });
    if (!esEnteroPositivo(id_doctor)) return res.status(400).json({ error: 'id_doctor debe ser un entero positivo' });
    // Validar id_tratamiento (simple) o array de tratamientos
    if (Array.isArray(tratamientos)) {
      if (tratamientos.length === 0) return res.status(400).json({ error: 'El arreglo tratamientos no puede estar vacío' });
      if (!tratamientos.every((t) => esEnteroPositivo(t))) return res.status(400).json({ error: 'Tratamientos inválidos en el arreglo' });
    } else if (id_tratamiento !== undefined && id_tratamiento !== null && !esEnteroPositivo(id_tratamiento)) {
      return res.status(400).json({ error: 'id_tratamiento inválido' });
    }
    if (!esFechaValida(fecha)) return res.status(400).json({ error: 'fecha inválida, formato YYYY-MM-DD' });
    if (!esFechaCitaDentroDeVentana(fecha)) {
      const { minDate, maxDate } = getCitaDateWindow();
      return res.status(400).json({ error: `La fecha de la cita debe estar entre ${minDate} y ${maxDate}` });
    }
    if (!esHoraValida(hora_inicio) || !esHoraValida(hora_fin)) return res.status(400).json({ error: 'hora_inicio/hora_fin inválida, formato HH:MM ó HH:MM:SS' });
    if (estado !== undefined && estado !== null && !estadosPermitidos.includes(String(estado))) return res.status(400).json({ error: `estado inválido. Debe ser: ${estadosPermitidos.join(', ')}` });

    // Verificar que paciente, doctor y tratamiento (si aplica) existen — RLS aplica
    const { data: pacienteExist, error: pe } = await supabaseUser.from('paciente').select('id_cedula').eq('id_cedula', String(id_paciente).trim()).maybeSingle();
    if (pe) return res.status(500).json({ error: pe.message || pe });
    if (!pacienteExist) return res.status(404).json({ error: 'Paciente no encontrado' });

    const { data: doctorExist, error: de } = await supabaseUser.from('doctor').select('id').eq('id', id_doctor).maybeSingle();
    if (de) return res.status(500).json({ error: de.message || de });
    if (!doctorExist) return res.status(404).json({ error: 'Doctor no encontrado' });

    const perfilId = await obtenerPerfilIdAutenticado(token, supabaseUser);

    // Calcular precio automáticamente si proporcionan tratamientos o un id_tratamiento
    let precioCalculado = null;
    if (Array.isArray(tratamientos)) {
      const ids = tratamientos.map((t) => Number(t));
      const { data: tratamientosData, error: te } = await supabaseUser.from('tratamiento').select('id, precio, nombre').in('id', ids);
      if (te) return res.status(500).json({ error: te.message || te });
      if (!tratamientosData || tratamientosData.length !== ids.length) {
        const encontrados = (tratamientosData || []).map((t) => Number(t.id));
        const faltantes = ids.filter((x) => !encontrados.includes(x));
        return res.status(404).json({ error: `Tratamientos no encontrados: ${faltantes.join(', ')}` });
      }
      precioCalculado = tratamientosData.reduce((s, t) => s + Number(t.precio || 0), 0);
    } else if (id_tratamiento) {
      const { data: tratExist, error: te } = await supabaseUser.from('tratamiento').select('id, precio').eq('id', Number(id_tratamiento)).maybeSingle();
      if (te) return res.status(500).json({ error: te.message || te });
      if (!tratExist) return res.status(404).json({ error: 'Tratamiento no encontrado' });
      precioCalculado = Number(tratExist.precio || 0);
    }

    const perfil = await getPerfilFromToken(token);

    const insertObj = {
      id_paciente: String(id_paciente).trim(),
      id_doctor: Number(id_doctor),
      // Nota: no se envía `id_tratamiento` en el payload de `cita` (usar tabla intermedia `cita_tratamiento`),
      id_perfil: id_perfil || perfilId || null,
      fecha: String(fecha),
      hora_inicio: String(hora_inicio),
      hora_fin: String(hora_fin),
      precio: typeof precio !== 'undefined' && precio !== null ? precio : (precioCalculado !== null ? precioCalculado : 0),
      estado: estado ? String(estado) : 'agendada'
    };
    // asignar sede_id: administrador -> su sede; superadmin puede enviar sede_id en body
    if (perfil && perfil.rol === 'superadmin') {
      if (req.body && req.body.sede_id) insertObj.sede_id = Number(req.body.sede_id);
    } else if (perfil && perfil.sede_id) {
      insertObj.sede_id = perfil.sede_id;
    }

    const { data, error } = await supabaseUser.from('cita').insert([insertObj]).select().maybeSingle();
    if (error) return res.status(400).json({ error: error.message || error });

    // Si se proporcionaron tratamientos, insertar filas en la tabla intermedia
    if (Array.isArray(tratamientos) && tratamientos.length > 0) {
      try {
        const ids = tratamientos.map((t) => Number(t));
        const { data: tratamientosData, error: te } = await supabaseUser.from('tratamiento').select('id, precio').in('id', ids);
        if (te) {
          // borrar cita creada para evitar datos huérfanos
          await supabaseUser.from('cita').delete().eq('id', data.id);
          return res.status(500).json({ error: te.message || te });
        }
        const encontrados = (tratamientosData || []).map((t) => Number(t.id));
        if (!tratamientosData || tratamientosData.length !== ids.length) {
          const faltantes = ids.filter((x) => !encontrados.includes(x));
          await supabaseUser.from('cita').delete().eq('id', data.id);
          return res.status(404).json({ error: `Tratamientos no encontrados: ${faltantes.join(', ')}` });
        }

        const payload = tratamientosData.map((t) => ({
          cita_id: data.id,
          tratamiento_id: Number(t.id),
          precio: Number(t.precio || 0),
          cantidad: 1
        }));

        const { error: insertCTErr } = await supabaseUser.from('cita_tratamiento').insert(payload);
        if (insertCTErr) {
          await supabaseUser.from('cita').delete().eq('id', data.id);
          return res.status(500).json({ error: insertCTErr.message || insertCTErr });
        }
        // Actualizar campo `tratamientos` en `cita` con solo los nombres separados por comas
        try {
          const nombres = tratamientosData.map((t) => t.nombre || '').filter(Boolean).join(', ');
          if (nombres) {
            await supabaseUser.from('cita').update({ tratamientos: nombres }).eq('id', data.id);
          }
        } catch (e) {
          // no crítico: la relación ya fue creada en cita_tratamiento
        }
      } catch (e) {
        await supabaseUser.from('cita').delete().eq('id', data.id);
        return res.status(500).json({ error: e.message || e });
      }
    } else if (id_tratamiento) {
      // insertar relación única si se proporcionó id_tratamiento simple
      try {
        const { data: tratExist, error: te } = await supabaseUser.from('tratamiento').select('id, precio, nombre').eq('id', Number(id_tratamiento)).maybeSingle();
        if (te) {
          await supabaseUser.from('cita').delete().eq('id', data.id);
          return res.status(500).json({ error: te.message || te });
        }
        if (tratExist) {
          const payload = [{ cita_id: data.id, tratamiento_id: Number(tratExist.id), precio: Number(tratExist.precio || 0), cantidad: 1 }];
          const { error: insertCTErr } = await supabaseUser.from('cita_tratamiento').insert(payload);
          if (insertCTErr) {
            await supabaseUser.from('cita').delete().eq('id', data.id);
            return res.status(500).json({ error: insertCTErr.message || insertCTErr });
          }
          // actualizar campo `tratamientos` con el nombre solo
          try {
            const nombre = tratExist.nombre || '';
            if (nombre) await supabaseUser.from('cita').update({ tratamientos: nombre }).eq('id', data.id);
          } catch (e) {}
        }
      } catch (e) {
        await supabaseUser.from('cita').delete().eq('id', data.id);
        return res.status(500).json({ error: e.message || e });
      }
    }

    return res.status(201).json({ mensaje: 'Cita creada', cita: data });
  } catch (error) {
    return res.status(500).json({ error: error.message || error });
  }
};

export const obtenerCitasController = async (req, res) => {
  try {
    const token = getAuthTokenFromReq(req);
    if (!token) return res.status(401).json({ error: 'Token no proporcionado' });
    const supabaseUser = getSupabaseClientWithToken(token);

    const { id_doctor, id_paciente, fecha, estado } = req.query || {};

    let query = supabaseUser.from('cita').select('*');

    if (id_doctor) {
      if (!esEnteroPositivo(id_doctor)) return res.status(400).json({ error: 'id_doctor inválido' });
      query = query.eq('id_doctor', Number(id_doctor));
    }
    if (id_paciente) {
      if (!esCedulaValida(id_paciente)) return res.status(400).json({ error: 'id_paciente inválido' });
      query = query.eq('id_paciente', String(id_paciente).trim());
    }
    if (fecha) {
      if (!esFechaValida(fecha)) return res.status(400).json({ error: 'fecha inválida, formato YYYY-MM-DD' });
      query = query.eq('fecha', String(fecha));
    }
    if (estado) {
      if (!estadosPermitidos.includes(String(estado))) return res.status(400).json({ error: `estado inválido. Debe ser: ${estadosPermitidos.join(', ')}` });
      query = query.eq('estado', String(estado));
    }

    // permitir filtrado por sede desde frontend (sedeActiva)
    const { sede_id: sedeQuery } = req.query || {};
    if (sedeQuery !== undefined && sedeQuery !== null && String(sedeQuery).trim() !== '') {
      const sid = Number(sedeQuery);
      if (!Number.isNaN(sid)) query = query.eq('sede_id', sid);
    }

    const { data, error } = await query.order('fecha', { ascending: false }).order('hora_inicio', { ascending: false });
    if (error) return res.status(500).json({ error: error.message || error });

    return res.json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message || error });
  }
};

export const obtenerCitaPorIdController = async (req, res) => {
  try {
    const token = getAuthTokenFromReq(req);
    if (!token) return res.status(401).json({ error: 'Token no proporcionado' });
    const supabaseUser = getSupabaseClientWithToken(token);

    const { id } = req.params;
    if (!esEnteroPositivo(id)) return res.status(400).json({ error: 'El id debe ser un numero entero positivo' });

    const { data, error } = await supabaseUser
      .from('cita')
      .select('*')
      .eq('id', Number(id))
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message || error });
    if (!data) return res.status(404).json({ error: 'Cita no encontrada' });

    return res.json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message || error });
  }
};

export const actualizarCitaController = async (req, res) => {
  try {
    const token = getAuthTokenFromReq(req);
    if (!token) return res.status(401).json({ error: 'Token no proporcionado' });
    const supabaseUser = getSupabaseClientWithToken(token);

    const { id } = req.params;
    if (!esEnteroPositivo(id)) return res.status(400).json({ error: 'El id debe ser un numero entero positivo' });

    if (typeof req.body !== 'object' || req.body === null || Array.isArray(req.body)) {
      return res.status(400).json({ error: 'El cuerpo de la solicitud debe ser un objeto JSON valido' });
    }

    const camposPermitidos = ['id_paciente', 'id_doctor', 'tratamientos', 'id_perfil', 'fecha', 'hora_inicio', 'hora_fin', 'precio', 'estado', 'metodo_pago', 'detalle_pago'];
    const camposRecibidos = Object.keys(req.body || {});
    if (camposRecibidos.length === 0) return res.status(400).json({ error: 'Debes enviar al menos un campo para actualizar' });
    const camposNoPermitidos = camposRecibidos.filter((c) => !camposPermitidos.includes(c));
    if (camposNoPermitidos.length > 0) return res.status(400).json({ error: `Campos no permitidos: ${camposNoPermitidos.join(', ')}` });

    const { data: existing, error: fetchErr } = await supabaseUser.from('cita').select('id, estado, precio, id_doctor, tratamientos, id_perfil').eq('id', Number(id)).maybeSingle();
    if (fetchErr) return res.status(500).json({ error: fetchErr.message || fetchErr });
    if (!existing) return res.status(404).json({ error: 'Cita no encontrada' });
    if (String(existing.estado || '').toLowerCase() === 'atendida') {
      return res.status(409).json({ error: 'La cita ya fue atendida y no puede editarse.' });
    }

    const perfilId = await obtenerPerfilIdAutenticado(token, supabaseUser);

    // decidir si usamos cliente admin para evitar RLS (permitir al propietario actualizar)
    const usarAdmin = perfilId && existing && existing.id_perfil === perfilId && supabaseAdmin;
    const dbClient = usarAdmin ? supabaseAdmin : supabaseUser;

    const updates = {};
    const { id_paciente, id_doctor, id_tratamiento, tratamientos, id_perfil, fecha, hora_inicio, hora_fin, precio, estado, metodo_pago, detalle_pago } = req.body;

    if (id_paciente !== undefined) {
      if (!esCedulaValida(id_paciente)) return res.status(400).json({ error: 'id_paciente inválido' });
      updates.id_paciente = String(id_paciente).trim();
    }
    if (id_doctor !== undefined) {
      if (!esEnteroPositivo(id_doctor)) return res.status(400).json({ error: 'id_doctor inválido' });
      updates.id_doctor = Number(id_doctor);
    }
    const precioExplicito = precio !== undefined && precio !== null && String(precio).trim() !== '';
    const precioFinalExplicito = precioExplicito ? Number(precio) : null;

    if (tratamientos !== undefined) {
      if (!Array.isArray(tratamientos)) return res.status(400).json({ error: 'tratamientos debe ser un arreglo de IDs' });
      if (tratamientos.length === 0) return res.status(400).json({ error: 'El arreglo tratamientos no puede estar vacío' });
      if (!tratamientos.every((t) => esEnteroPositivo(t))) return res.status(400).json({ error: 'Tratamientos inválidos en el arreglo' });
      // Consultar precios y calcular total
      const ids = tratamientos.map((t) => Number(t));
      const { data: tratamientosData, error: te } = await supabaseUser.from('tratamiento').select('id, precio').in('id', ids);
      if (te) return res.status(500).json({ error: te.message || te });
      if (!tratamientosData || tratamientosData.length !== ids.length) {
        const encontrados = (tratamientosData || []).map((t) => Number(t.id));
        const faltantes = ids.filter((x) => !encontrados.includes(x));
        return res.status(404).json({ error: `Tratamientos no encontrados: ${faltantes.join(', ')}` });
      }
      // Solo calcular automáticamente el monto si el cliente no envía un valor explícito.
      if (!precioExplicito) {
        const total = tratamientosData.reduce((s, t) => s + Number(t.precio || 0), 0);
        updates.precio = total;
      }
      // Do not write `id_tratamiento` directly on `cita` because some DB
      // schemas do not include that column. Use the `cita_tratamiento`
      // relation table to store treatments (handled below).
    }
    if (id_perfil !== undefined) updates.id_perfil = id_perfil || null;
    if (fecha !== undefined) {
      if (!esFechaValida(fecha)) return res.status(400).json({ error: 'fecha inválida, formato YYYY-MM-DD' });
      if (!esFechaCitaDentroDeVentana(fecha)) {
        const { minDate, maxDate } = getCitaDateWindow();
        return res.status(400).json({ error: `La fecha de la cita debe estar entre ${minDate} y ${maxDate}` });
      }
      updates.fecha = String(fecha);
    }
    if (hora_inicio !== undefined) {
      if (!esHoraValida(hora_inicio)) return res.status(400).json({ error: 'hora_inicio inválida' });
      updates.hora_inicio = String(hora_inicio);
    }
    if (hora_fin !== undefined) {
      if (!esHoraValida(hora_fin)) return res.status(400).json({ error: 'hora_fin inválida' });
      updates.hora_fin = String(hora_fin);
    }
    // El precio explícito del formulario tiene prioridad sobre la sumatoria de tratamientos.
    // Si no viene precio, entonces se conserva el cálculo automático.
    if (precioExplicito) {
      if (Number.isNaN(precioFinalExplicito) || precioFinalExplicito < 0) return res.status(400).json({ error: 'precio inválido' });
      updates.precio = precioFinalExplicito;
    }
    if (estado !== undefined) {
      if (!estadosPermitidos.includes(String(estado))) return res.status(400).json({ error: `estado inválido. Debe ser: ${estadosPermitidos.join(', ')}` });
      updates.estado = String(estado);
      // Al pasar a Atendida, garantizar id_perfil para que el trigger de BD registre el ingreso correctamente.
      if (String(estado) === 'Atendida' && !id_perfil && !existing.id_perfil && perfilId) {
        updates.id_perfil = perfilId;
      }
    }

    // aceptar metodo_pago y detalle_pago (opcionales) y validarlos (no escribimos en `cita`, se usan para el movimiento)
    let metodoPagoNormCita = undefined;
    if (metodo_pago !== undefined) {
      const mpNormTmp = normalizeMetodoPago(metodo_pago);
      if (mpNormTmp === null) return res.status(400).json({ error: `metodo_pago inválido. Debe ser uno de: efectivo, transferencia, tarjeta, deposito` });
      metodoPagoNormCita = mpNormTmp;
    }
    if (detalle_pago !== undefined) {
      if (detalle_pago !== null && typeof detalle_pago !== 'string') return res.status(400).json({ error: 'detalle_pago debe ser una cadena' });
    }

    if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No hay campos válidos para actualizar' });

    const { data, error } = await dbClient.from('cita').update(updates).eq('id', Number(id)).select().maybeSingle();
    if (error) return res.status(400).json({ error: error.message || error });

    // Respaldo: si el trigger creó el movimiento con id_perfil NULL, corregir el último registro generado.
    try {
      const estadoPrevio = existing && existing.estado ? String(existing.estado) : null;
      const estadoNuevo = data && data.estado ? String(data.estado) : null;
      if (estadoPrevio !== 'Atendida' && estadoNuevo === 'Atendida' && perfilId) {
        const finClient = supabaseAdmin || supabaseUser;
          // Prefer the cita's date for the movimiento. Use data.fecha when available.
          const citaFecha = data && data.fecha ? String(data.fecha).slice(0, 10) : (new Date().toISOString().slice(0, 10));
          const { data: movNull, error: movNullErr } = await finClient
            .from('movimiento_finanzas')
            .select('id, descripcion, metodo_pago, created_at')
            .is('id_perfil', null)
            .eq('id_doctor', Number(data.id_doctor))
            .eq('tipo', 'ingreso')
            .eq('monto', Number(data.precio || 0))
            .eq('fecha', citaFecha)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!movNullErr && movNull && movNull.id) {
            const updateObj = { id_perfil: perfilId, fecha: citaFecha };
            if (metodoPagoNormCita) updateObj.metodo_pago = metodoPagoNormCita;
            if (detalle_pago) {
              const base = movNull.descripcion || '';
              updateObj.descripcion = base ? `${base} - ${String(detalle_pago)}` : String(detalle_pago);
            }

            await finClient.from('movimiento_finanzas').update(updateObj).eq('id', movNull.id);
            // Recalculate caja totals for the cita period
            try {
              const parts = String(citaFecha).split('-');
              const y = Number(parts[0]);
              const m = Number(parts[1]);
              if (!Number.isNaN(y) && !Number.isNaN(m) && finClient) await actualizarTotalesCajaParaPeriodo(finClient, data.sede_id || perfil?.sede_id, y, m);
            } catch (e) {
              // don't block flow
            }
          } else {
          // Si no existe el movimiento creado por el trigger, crear uno explícitamente
            try {
            const createObj = {
              id_perfil: perfilId,
              id_doctor: Number(data.id_doctor),
              tipo: 'ingreso',
              monto: Number(data.precio || 0),
              descripcion: detalle_pago ? String(detalle_pago) : (data.tratamientos ? `consulta de: ${data.tratamientos}` : ''),
              fecha: citaFecha,
              created_at: new Date(`${citaFecha}T00:00:00`).toISOString()
            };
              if (metodoPagoNormCita) createObj.metodo_pago = metodoPagoNormCita;
            // Asignar sede si está disponible en la cita o en el perfil
            try {
              const sedeFromData = data && data.sede_id ? data.sede_id : null;
              if (sedeFromData) createObj.sede_id = sedeFromData;
              else if (perfil && perfil.sede_id) createObj.sede_id = perfil.sede_id;
            } catch (e) {}
            await finClient.from('movimiento_finanzas').insert([createObj]);
            // After creating movement, recalculate caja totals for the cita's month
            try {
              const parts2 = String(citaFecha).split('-');
              const y2 = Number(parts2[0]);
              const m2 = Number(parts2[1]);
              if (!Number.isNaN(y2) && !Number.isNaN(m2) && finClient) await actualizarTotalesCajaParaPeriodo(finClient, createObj.sede_id || data.sede_id || perfil?.sede_id, y2, m2);
            } catch (e) {
              // ignore
            }
          } catch (e) {
            // no bloquear flujo principal
          }
        }
      }
    } catch (e) {
      // no bloquear flujo principal por fallback
    }

    // Si se enviaron tratamientos, reemplazar las relaciones en la tabla intermedia
    if (tratamientos !== undefined) {
      try {
        // eliminar relacionadas existentes
        const { error: delErr } = await supabaseUser.from('cita_tratamiento').delete().eq('cita_id', Number(id));
        if (delErr) return res.status(500).json({ error: delErr.message || delErr });

        // si tratamientos no está vacío, insertar nuevas relaciones
        if (Array.isArray(tratamientos) && tratamientos.length > 0) {
          const ids = tratamientos.map((t) => Number(t));
          const { data: tratamientosData, error: te } = await supabaseUser.from('tratamiento').select('id, precio, nombre').in('id', ids);
          if (te) return res.status(500).json({ error: te.message || te });
          const encontrados = (tratamientosData || []).map((t) => Number(t.id));
          if (!tratamientosData || tratamientosData.length !== ids.length) {
            const faltantes = ids.filter((x) => !encontrados.includes(x));
            return res.status(404).json({ error: `Tratamientos no encontrados: ${faltantes.join(', ')}` });
          }
          const payload = tratamientosData.map((t) => ({ cita_id: Number(id), tratamiento_id: Number(t.id), precio: Number(t.precio || 0), cantidad: 1 }));
          const { error: insertCTErr } = await supabaseUser.from('cita_tratamiento').insert(payload);
          if (insertCTErr) return res.status(500).json({ error: insertCTErr.message || insertCTErr });
          // actualizar campo `tratamientos` con nombres separados por comas
          try {
            const nombres = tratamientosData.map((t) => t.nombre || '').filter(Boolean).join(', ');
            if (nombres) {
              await supabaseUser.from('cita').update({ tratamientos: nombres }).eq('id', Number(id));
            } else {
              await supabaseUser.from('cita').update({ tratamientos: '' }).eq('id', Number(id));
            }
          } catch (e) {}
        }
      } catch (e) {
        return res.status(500).json({ error: e.message || e });
      }
    }

    // Reaplicar el monto explícito al final por si alguna lógica de BD ajusta la cita
    // después de sincronizar las relaciones de tratamientos.
    if (precioExplicito && Number.isFinite(precioFinalExplicito)) {
      const { error: finalPrecioErr } = await dbClient
        .from('cita')
        .update({ precio: precioFinalExplicito })
        .eq('id', Number(id));
      if (finalPrecioErr) return res.status(500).json({ error: finalPrecioErr.message || finalPrecioErr });
    }

    const citaRespuesta = precioExplicito && Number.isFinite(precioFinalExplicito)
      ? { ...data, precio: precioFinalExplicito }
      : data;

    return res.json({ mensaje: 'Cita actualizada', cita: citaRespuesta });
  } catch (error) {
    return res.status(500).json({ error: error.message || error });
  }
};

export const eliminarCitaController = async (req, res) => {
  try {
    const token = getAuthTokenFromReq(req);
    if (!token) return res.status(401).json({ error: 'Token no proporcionado' });
    const supabaseUser = getSupabaseClientWithToken(token);

    const { id } = req.params;
    if (!esEnteroPositivo(id)) return res.status(400).json({ error: 'El id debe ser un numero entero positivo' });

    const { data: existing, error: fetchErr } = await supabaseUser.from('cita').select('id').eq('id', Number(id)).maybeSingle();
    if (fetchErr) return res.status(500).json({ error: fetchErr.message || fetchErr });
    if (!existing) return res.status(404).json({ error: 'Cita no encontrada' });

    const { error } = await supabaseUser.from('cita').delete().eq('id', Number(id));
    if (error) return res.status(500).json({ error: error.message || error });

    return res.json({ mensaje: 'Cita eliminada' });
  } catch (error) {
    return res.status(500).json({ error: error.message || error });
  }
};

export default {
  crearCitaController,
  obtenerCitasController,
  obtenerCitaPorIdController,
  actualizarCitaController,
  eliminarCitaController
};
