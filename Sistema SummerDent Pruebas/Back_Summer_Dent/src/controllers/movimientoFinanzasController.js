import { getSupabaseClientWithToken, supabaseAdmin } from '../configuracionesDB/supabaseClient.js';

const tipoPermitidos = ['ingreso', 'egreso'];
const esEnteroPositivo = (v) => /^\d+$/.test(String(v || '').trim()) && Number(String(v).trim()) > 0;
const esFechaValida = (f) => typeof f === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(f) && !Number.isNaN(new Date(`${f}T00:00:00`).getTime());
const esDecimalPositivo = (m) => {
  if (m === undefined || m === null) return false;
  const num = Number(String(m).trim());
  return Number.isFinite(num) && num > 0;
};

export const crearMovimientoController = async (req, res) => {
  try {
    const token = (req.headers.authorization || '').startsWith('Bearer ') ? req.headers.authorization.replace('Bearer ', '').trim() : null;
    if (!token) return res.status(401).json({ error: 'Token no proporcionado' });
    const supabaseUser = getSupabaseClientWithToken(token);

    const { id_doctor, tipo, monto, descripcion } = req.body || {};

    if (!tipo || !tipoPermitidos.includes(String(tipo))) return res.status(400).json({ error: `tipo inválido. Debe ser: ${tipoPermitidos.join(', ')}` });
    if (!esDecimalPositivo(monto)) return res.status(400).json({ error: 'monto inválido, debe ser número mayor que 0' });
    if (id_doctor !== undefined && id_doctor !== null && !esEnteroPositivo(id_doctor)) return res.status(400).json({ error: 'id_doctor inválido' });

    // Obtener id de perfil (usuario autenticado) desde el cliente supabase con token
    let perfilId = null;
    try {
      const { data: userData } = await supabaseUser.auth.getUser();
      if (userData && userData.user && userData.user.id) perfilId = userData.user.id;
      else if (userData && userData.id) perfilId = userData.id;
    } catch (e) {
      perfilId = null;
    }

    // Forzar id_perfil y fecha según la acción actual
    const hoy = new Date().toISOString().slice(0,10);
    const payload = {
      id_perfil: perfilId || null,
      id_doctor: id_doctor !== undefined && id_doctor !== null ? Number(id_doctor) : null,
      tipo: String(tipo),
      monto: Number(Number(monto).toFixed(2)),
      descripcion: descripcion ? String(descripcion).trim() : null,
      fecha: hoy,
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabaseUser.from('movimiento_finanzas').insert([payload]).select().maybeSingle();
    if (error) return res.status(400).json({ error: error.message || error });
    return res.status(201).json({ mensaje: 'Movimiento creado', movimiento: data });
  } catch (error) {
    return res.status(500).json({ error: error.message || error });
  }
};

export const obtenerMovimientosController = async (req, res) => {
  try {
    const token = (req.headers.authorization || '').startsWith('Bearer ') ? req.headers.authorization.replace('Bearer ', '').trim() : null;
    if (!token) return res.status(401).json({ error: 'Token no proporcionado' });
    const supabaseUser = getSupabaseClientWithToken(token);

    const { tipo, desde, hasta, id_doctor, id_perfil } = req.query || {};

    // validaciones
    if (tipo !== undefined && tipo !== null && !tipoPermitidos.includes(String(tipo))) return res.status(400).json({ error: `tipo inválido. Debe ser: ${tipoPermitidos.join(', ')}` });
    if (desde !== undefined && desde !== null && !esFechaValida(String(desde))) return res.status(400).json({ error: 'desde inválido, formato YYYY-MM-DD' });
    if (hasta !== undefined && hasta !== null && !esFechaValida(String(hasta))) return res.status(400).json({ error: 'hasta inválido, formato YYYY-MM-DD' });
    if (id_doctor !== undefined && id_doctor !== null && !esEnteroPositivo(id_doctor)) return res.status(400).json({ error: 'id_doctor inválido' });

    let query = supabaseUser.from('movimiento_finanzas').select('*, doctor(*)');

    if (tipo) query = query.eq('tipo', String(tipo));
    if (id_doctor) query = query.eq('id_doctor', Number(id_doctor));
    if (id_perfil) query = query.eq('id_perfil', String(id_perfil));
    if (desde) query = query.gte('fecha', String(desde));
    if (hasta) query = query.lte('fecha', String(hasta));

    const { data, error } = await query.order('fecha', { ascending: false }).order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message || error });
    return res.json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message || error });
  }
};

export const obtenerMovimientoPorIdController = async (req, res) => {
  try {
    const token = (req.headers.authorization || '').startsWith('Bearer ') ? req.headers.authorization.replace('Bearer ', '').trim() : null;
    if (!token) return res.status(401).json({ error: 'Token no proporcionado' });
    const supabaseUser = getSupabaseClientWithToken(token);

    const { id } = req.params;
    if (!esEnteroPositivo(id)) return res.status(400).json({ error: 'El id debe ser un numero entero positivo' });

    const { data, error } = await supabaseUser.from('movimiento_finanzas').select('*, doctor(*)').eq('id', Number(id)).maybeSingle();
    if (error) return res.status(500).json({ error: error.message || error });
    if (!data) return res.status(404).json({ error: 'Movimiento no encontrado' });
    return res.json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message || error });
  }
};

export const actualizarMovimientoController = async (req, res) => {
  try {
    const token = (req.headers.authorization || '').startsWith('Bearer ') ? req.headers.authorization.replace('Bearer ', '').trim() : null;
    if (!token) return res.status(401).json({ error: 'Token no proporcionado' });
    const supabaseUser = getSupabaseClientWithToken(token);

    const { id } = req.params;
    if (!esEnteroPositivo(id)) return res.status(400).json({ error: 'El id debe ser un numero entero positivo' });

    if (typeof req.body !== 'object' || req.body === null || Array.isArray(req.body)) return res.status(400).json({ error: 'El cuerpo de la solicitud debe ser un objeto JSON valido' });

    const camposPermitidos = ['id_doctor', 'tipo', 'monto', 'descripcion', 'fecha'];
    const recibidos = Object.keys(req.body || {});
    if (recibidos.length === 0) return res.status(400).json({ error: 'Debes enviar al menos un campo para actualizar' });
    const noPermitidos = recibidos.filter((c) => !camposPermitidos.includes(c));
    if (noPermitidos.length > 0) return res.status(400).json({ error: `Campos no permitidos: ${noPermitidos.join(', ')}` });

    const { data: existing, error: fetchErr } = await supabaseUser.from('movimiento_finanzas').select('*').eq('id', Number(id)).maybeSingle();
    if (fetchErr) return res.status(500).json({ error: fetchErr.message || fetchErr });
    if (!existing) return res.status(404).json({ error: 'Movimiento no encontrado' });

    const updates = {};
    const { id_doctor, tipo, monto, descripcion, fecha } = req.body;
    if (id_doctor !== undefined) {
      if (id_doctor !== null && !esEnteroPositivo(id_doctor)) return res.status(400).json({ error: 'id_doctor inválido' });
      updates.id_doctor = id_doctor !== null ? Number(id_doctor) : null;
    }
    if (tipo !== undefined) {
      if (!tipoPermitidos.includes(String(tipo))) return res.status(400).json({ error: `tipo inválido. Debe ser: ${tipoPermitidos.join(', ')}` });
      updates.tipo = String(tipo);
    }
    if (monto !== undefined) {
      if (!esDecimalPositivo(monto)) return res.status(400).json({ error: 'monto inválido, debe ser número mayor que 0' });
      updates.monto = Number(Number(monto).toFixed(2));
    }
    if (descripcion !== undefined) updates.descripcion = descripcion ? String(descripcion).trim() : null;
    if (fecha !== undefined) {
      if (!esFechaValida(String(fecha))) return res.status(400).json({ error: 'fecha inválida, formato YYYY-MM-DD' });
      updates.fecha = String(fecha);
    }

    if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No hay campos válidos para actualizar' });

    const { data, error } = await supabaseUser.from('movimiento_finanzas').update(updates).eq('id', Number(id)).select().maybeSingle();
    if (error) return res.status(400).json({ error: error.message || error });
    return res.json({ mensaje: 'Movimiento actualizado', movimiento: data });
  } catch (error) {
    return res.status(500).json({ error: error.message || error });
  }
};

export const eliminarMovimientoController = async (req, res) => {
  try {
    const token = (req.headers.authorization || '').startsWith('Bearer ') ? req.headers.authorization.replace('Bearer ', '').trim() : null;
    if (!token) return res.status(401).json({ error: 'Token no proporcionado' });
    const supabaseUser = getSupabaseClientWithToken(token);

    const { id } = req.params;
    if (!esEnteroPositivo(id)) return res.status(400).json({ error: 'El id debe ser un numero entero positivo' });

    const { data: existing, error: fetchErr } = await supabaseUser.from('movimiento_finanzas').select('id').eq('id', Number(id)).maybeSingle();
    if (fetchErr) return res.status(500).json({ error: fetchErr.message || fetchErr });
    if (!existing) return res.status(404).json({ error: 'Movimiento no encontrado' });

    const { error } = await supabaseUser.from('movimiento_finanzas').delete().eq('id', Number(id));
    if (error) return res.status(500).json({ error: error.message || error });
    return res.json({ mensaje: 'Movimiento eliminado' });
  } catch (error) {
    return res.status(500).json({ error: error.message || error });
  }
};

export const ingresosController = async (req, res) => {
  const wrappedReq = {
    headers: req.headers,
    query: Object.assign({}, (req.query || {}), { tipo: 'ingreso' })
  };
  return obtenerMovimientosController(wrappedReq, res);
};

export const egresosController = async (req, res) => {
  const wrappedReq = {
    headers: req.headers,
    query: Object.assign({}, (req.query || {}), { tipo: 'egreso' })
  };
  return obtenerMovimientosController(wrappedReq, res);
};

export default {
  crearMovimientoController,
  obtenerMovimientosController,
  obtenerMovimientoPorIdController,
  actualizarMovimientoController,
  eliminarMovimientoController,
  ingresosController,
  egresosController
};
