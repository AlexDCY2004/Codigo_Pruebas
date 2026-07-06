import { getSupabaseClientWithToken, supabaseAdmin } from '../configuracionesDB/supabaseClient.js';
import { getPerfilFromToken } from '../utils/perfilUtils.js';
import { getAuthTokenFromReq } from '../utils/authUtils.js';

const esEnteroPositivo = (v) => /^\d+$/.test(String(v || '').trim()) && Number(String(v).trim()) > 0;
const esFechaValida = (f) => typeof f === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(f) && !Number.isNaN(new Date(`${f}T00:00:00`).getTime());
const esDecimalPositivo = (m) => {
  if (m === undefined || m === null) return false;
  const s = String(m).trim();
  // Allow up to 5 integer digits and optional 1-2 decimals
  if (!/^\d{1,5}(\.\d{1,2})?$/.test(s)) return false;
  const num = Number(s);
  return Number.isFinite(num) && num > 0;
};

// Normalize payment method tokens (fallback for legacy strings)
export const normalizeMetodoPago = (input) => {
  if (input === undefined || input === null) return undefined;
  const s = String(input).trim().toLowerCase();
  if (s === '') return undefined;
  if (s.includes('efectivo')) return 'efectivo';
  if (s.includes('deposito') || s.includes('depósito')) return 'deposito';
  if (s.includes('tarjeta')) return 'tarjeta';
  if (s.includes('transfer')) return 'transferencia';
  return null; // unknown
};

export const crearMovimientoController = async (req, res) => {
  try {
    const token = getAuthTokenFromReq(req);
    if (!token) return res.status(401).json({ error: 'Token no proporcionado' });
    const supabaseUser = getSupabaseClientWithToken(token);

    const { id_doctor, monto, descripcion, fecha, metodo_pago } = req.body || {};

    // Normalize metodo_pago (accept legacy tokens) and validate inputs
    const metodoNorm = normalizeMetodoPago(metodo_pago);
    if (metodo_pago !== undefined && metodo_pago !== null && String(metodo_pago).trim() !== '' && metodoNorm === null) {
      return res.status(400).json({ error: `metodo_pago inválido. Valores permitidos: efectivo, transferencia, tarjeta, deposito` });
    }

    if (!esDecimalPositivo(monto)) return res.status(400).json({ error: 'monto inválido, debe ser número mayor que 0' });
    if (id_doctor !== undefined && id_doctor !== null && !esEnteroPositivo(id_doctor)) return res.status(400).json({ error: 'id_doctor inválido' });
    if (fecha !== undefined && fecha !== null && !esFechaValida(String(fecha))) {
      return res.status(400).json({ error: 'fecha inválida, formato YYYY-MM-DD' });
    }

    // Obtener id de perfil (usuario autenticado) desde el cliente supabase con token
    let perfilId = null;
    try {
      const { data: userData } = await supabaseUser.auth.getUser();
      if (userData && userData.user && userData.user.id) perfilId = userData.user.id;
      else if (userData && userData.id) perfilId = userData.id;
    } catch (e) {
      perfilId = null;
    }

    // determinar sede según perfil o body (superadmin)
    const perfil = await getPerfilFromToken(token);
    let sedeToUse = null;
    if (perfil && perfil.rol === 'superadmin') {
      if (req.body && req.body.sede_id) sedeToUse = Number(req.body.sede_id);
    } else if (perfil && perfil.sede_id) {
      sedeToUse = perfil.sede_id;
    }

    // Forzar id_perfil y usar fecha enviada (si viene válida), caso contrario usar hoy.
    // Use server local date (YYYY-MM-DD) to avoid timezone shifts from toISOString()
    const getLocalDateYYYYMMDD = () => {
      const d = new Date();
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };
    const hoy = getLocalDateYYYYMMDD();
    const fechaSolicitada = fecha ? String(fecha).slice(0, 10) : hoy;
    const payload = {
      id_perfil: perfilId || null,
      id_doctor: id_doctor !== undefined && id_doctor !== null ? Number(id_doctor) : null,
      monto: Number(Number(monto).toFixed(2)),
      descripcion: descripcion ? String(descripcion).trim() : null,
      metodo_pago: (metodoNorm !== undefined) ? metodoNorm : undefined,
      fecha: fechaSolicitada,
      created_at: new Date().toISOString()
    };
    if (sedeToUse !== null) payload.sede_id = sedeToUse;

    const { data, error } = await supabaseUser.from('movimiento_finanzas').insert([payload]).select().maybeSingle();
    if (error) return res.status(400).json({ error: error.message || error });

    // Algunas instalaciones tienen triggers/policies que fijan la fecha al día actual al insertar.
    // Si ocurre, corregimos inmediatamente al valor solicitado por el usuario.
    if (data && data.id && String(data.fecha || '') !== fechaSolicitada) {
      const { data: corrected, error: correctErr } = await supabaseUser
        .from('movimiento_finanzas')
        .update({ fecha: fechaSolicitada })
        .eq('id', Number(data.id))
        .select()
        .maybeSingle();

      if (!correctErr && corrected) {
        return res.status(201).json({ mensaje: 'Movimiento creado', movimiento: corrected });
      }
    }

    return res.status(201).json({ mensaje: 'Movimiento creado', movimiento: data });
  } catch (error) {
    return res.status(500).json({ error: error.message || error });
  }
};

export const obtenerMovimientosController = async (req, res) => {
  try {
    const token = getAuthTokenFromReq(req);
    if (!token) return res.status(401).json({ error: 'Token no proporcionado' });
    const supabaseUser = getSupabaseClientWithToken(token);

    const { desde, hasta, id_doctor, id_perfil, metodo_pago } = req.query || {};

    // validaciones
    if (desde !== undefined && desde !== null && !esFechaValida(String(desde))) return res.status(400).json({ error: 'desde inválido, formato YYYY-MM-DD' });
    if (hasta !== undefined && hasta !== null && !esFechaValida(String(hasta))) return res.status(400).json({ error: 'hasta inválido, formato YYYY-MM-DD' });
    if (id_doctor !== undefined && id_doctor !== null && !esEnteroPositivo(id_doctor)) return res.status(400).json({ error: 'id_doctor inválido' });
    // Normalize metodo_pago query param if provided
    let metodoFilter = undefined;
    if (metodo_pago !== undefined && metodo_pago !== null && String(metodo_pago).trim() !== '') {
      const mpNorm = normalizeMetodoPago(metodo_pago);
      if (mpNorm === null) return res.status(400).json({ error: `metodo_pago inválido. Debe ser uno de: efectivo, transferencia, tarjeta, deposito` });
      metodoFilter = mpNorm;
    }

    let query = supabaseUser.from('movimiento_finanzas').select('*, doctor(*)');

    // Filtrar por sede si se solicita (frontend enviará `sede_id` como query param)
    const { sede_id: sedeQuery } = req.query || {};
    if (sedeQuery !== undefined && sedeQuery !== null && String(sedeQuery).trim() !== '') {
      const sid = Number(sedeQuery);
      if (!Number.isNaN(sid)) query = query.eq('sede_id', sid);
    }

    if (id_doctor) query = query.eq('id_doctor', Number(id_doctor));
    if (id_perfil) query = query.eq('id_perfil', String(id_perfil));
    if (metodoFilter) query = query.eq('metodo_pago', metodoFilter);
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
    const token = getAuthTokenFromReq(req);
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
    const token = getAuthTokenFromReq(req);
    if (!token) return res.status(401).json({ error: 'Token no proporcionado' });
    const supabaseUser = getSupabaseClientWithToken(token);

    const { id } = req.params;
    if (!esEnteroPositivo(id)) return res.status(400).json({ error: 'El id debe ser un numero entero positivo' });

    if (typeof req.body !== 'object' || req.body === null || Array.isArray(req.body)) return res.status(400).json({ error: 'El cuerpo de la solicitud debe ser un objeto JSON valido' });

    const camposPermitidos = ['id_doctor', 'monto', 'descripcion', 'fecha', 'metodo_pago', 'sede_id'];
    const recibidos = Object.keys(req.body || {});
    if (recibidos.length === 0) return res.status(400).json({ error: 'Debes enviar al menos un campo para actualizar' });
    const noPermitidos = recibidos.filter((c) => !camposPermitidos.includes(c));
    if (noPermitidos.length > 0) return res.status(400).json({ error: `Campos no permitidos: ${noPermitidos.join(', ')}` });

    const { data: existing, error: fetchErr } = await supabaseUser.from('movimiento_finanzas').select('*').eq('id', Number(id)).maybeSingle();
    if (fetchErr) return res.status(500).json({ error: fetchErr.message || fetchErr });
    if (!existing) return res.status(404).json({ error: 'Movimiento no encontrado' });

    const updates = {};
    const { id_doctor, monto, descripcion, fecha, metodo_pago, sede_id } = req.body;
    if (id_doctor !== undefined) {
      if (id_doctor !== null && !esEnteroPositivo(id_doctor)) return res.status(400).json({ error: 'id_doctor inválido' });
      updates.id_doctor = id_doctor !== null ? Number(id_doctor) : null;
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
    if (metodo_pago !== undefined) {
      if (metodo_pago === null || String(metodo_pago).trim() === '') {
        updates.metodo_pago = null;
      } else {
        const mpNorm = normalizeMetodoPago(metodo_pago);
        if (mpNorm === null) return res.status(400).json({ error: `metodo_pago inválido. Debe ser uno de: efectivo, transferencia, tarjeta, deposito` });
        updates.metodo_pago = mpNorm;
      }
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
    const token = getAuthTokenFromReq(req);
    if (!token) return res.status(401).json({ error: 'Token no proporcionado' });
    const supabaseUser = getSupabaseClientWithToken(token);

    const { id } = req.params;
    if (!esEnteroPositivo(id)) return res.status(400).json({ error: 'El id debe ser un numero entero positivo' });

    const { data: existing, error: fetchErr } = await supabaseUser.from('movimiento_finanzas').select('fecha, sede_id').eq('id', Number(id)).maybeSingle();
    if (fetchErr) return res.status(500).json({ error: fetchErr.message || fetchErr });
    if (!existing) return res.status(404).json({ error: 'Movimiento no encontrado' });

    const { error } = await supabaseUser.from('movimiento_finanzas').delete().eq('id', Number(id));
    if (error) return res.status(500).json({ error: error.message || error });

    return res.json({ mensaje: 'Movimiento eliminado' });
  } catch (error) {
    return res.status(500).json({ error: error.message || error });
  }
};

export default {
  crearMovimientoController,
  obtenerMovimientosController,
  obtenerMovimientoPorIdController,
  actualizarMovimientoController,
  eliminarMovimientoController
};
