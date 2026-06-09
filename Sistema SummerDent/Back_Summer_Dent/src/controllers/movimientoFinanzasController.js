import { getSupabaseClientWithToken, supabaseAdmin } from '../configuracionesDB/supabaseClient.js';
import { getPerfilFromToken } from '../utils/perfilUtils.js';
import { getAuthTokenFromReq } from '../utils/authUtils.js';

const tipoPermitidos = ['ingreso', 'egreso'];
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

// Helper: recalcula los totales de caja_mensual para una sede y periodo (anio, mes)
export async function actualizarTotalesCajaParaPeriodo(supabaseClient, sedeId, anio, mes) {
  try {
    const month = String(mes).padStart(2, '0');
    const desde = `${anio}-${month}-01`;
    // calcular último día del mes
    const lastDay = new Date(anio, mes, 0).getDate();
    const hasta = `${anio}-${month}-${String(lastDay).padStart(2, '0')}`;

    // Consider cash payments and bank deposit movements as affecting physical
    // cash balance. Include exact 'efectivo' and legacy deposit tokens
    // (eg. 'deposito bancario') by matching ilike '%deposito%'. Deposits
    // (moving cash to bank) should decrement physical cash.
    const { data: movimientos, error: movErr } = await supabaseClient
      .from('movimiento_finanzas')
      .select('tipo, monto, metodo_pago')
      .eq('sede_id', sedeId)
      .or('metodo_pago.eq.efectivo,metodo_pago.ilike.%deposito%')
      .gte('fecha', desde)
      .lte('fecha', hasta);

    if (movErr) throw movErr;

    let totalIngresos = 0;
    let totalEgresos = 0;
    (movimientos || []).forEach((mv) => {
      const m = Number(mv.monto || 0);
      if (String(mv.tipo) === 'ingreso') totalIngresos += m;
      else if (String(mv.tipo) === 'egreso') totalEgresos += m;
    });

    totalIngresos = Number(totalIngresos.toFixed(2));
    totalEgresos = Number(totalEgresos.toFixed(2));

    // intentar actualizar registro existente de caja_mensual
    const { data: existing, error: existErr } = await supabaseClient
      .from('caja_mensual')
      .select('*')
      .eq('sede_id', sedeId)
      .eq('anio', anio)
      .eq('mes', mes)
      .maybeSingle();

    if (existErr) throw existErr;

    if (existing) {
      const { error: updErr } = await supabaseClient
        .from('caja_mensual')
        .update({ total_ingresos: totalIngresos, total_egresos: totalEgresos, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
      if (updErr) throw updErr;
    } else {
      // crear registro de caja con saldo_inicial 0
      const toInsert = {
        sede_id: sedeId,
        id_perfil: null,
        anio,
        mes,
        saldo_inicial: 0,
        total_ingresos: totalIngresos,
        total_egresos: totalEgresos,
        observacion: null,
        cerrado: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      const { error: insErr } = await supabaseClient.from('caja_mensual').insert([toInsert]);
      if (insErr) throw insErr;
    }
  } catch (err) {
    console.error('actualizarTotalesCajaParaPeriodo error:', err);
    throw err;
  }
}

export const crearMovimientoController = async (req, res) => {
  try {
    const token = getAuthTokenFromReq(req);
    if (!token) return res.status(401).json({ error: 'Token no proporcionado' });
    const supabaseUser = getSupabaseClientWithToken(token);

    const { id_doctor, tipo, monto, descripcion, fecha, metodo_pago } = req.body || {};

    // Normalize metodo_pago (accept legacy tokens) and validate inputs
    const metodoNorm = normalizeMetodoPago(metodo_pago);
    if (metodo_pago !== undefined && metodo_pago !== null && String(metodo_pago).trim() !== '' && metodoNorm === null) {
      return res.status(400).json({ error: `metodo_pago inválido. Valores permitidos: efectivo, transferencia, tarjeta, deposito` });
    }

    // If the payment method is 'deposito' treat it as an egreso (cash -> bank)
    const tipoFinal = (metodoNorm === 'deposito') ? 'egreso' : tipo;

    if (!tipoFinal || !tipoPermitidos.includes(String(tipoFinal))) return res.status(400).json({ error: `tipo inválido. Debe ser: ${tipoPermitidos.join(', ')}` });
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
      tipo: String(tipoFinal),
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

    // después de crear movimiento, actualizar totales de caja_mensual para la sede/año/mes
    try {
      const fechaParts = String(fechaSolicitada).split('-');
      const y = Number(fechaParts[0]);
      const m = Number(fechaParts[1]);
      if (sedeToUse !== null && !Number.isNaN(y) && !Number.isNaN(m)) {
        await actualizarTotalesCajaParaPeriodo(supabaseUser, sedeToUse, y, m);
      }
    } catch (e) {
      // no interrumpir la creación por fallo en recalculo de totales
      console.error('Error actualizando totales de caja tras crear movimiento', e);
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

    const { tipo, desde, hasta, id_doctor, id_perfil, metodo_pago } = req.query || {};

    // validaciones
    if (tipo !== undefined && tipo !== null && !tipoPermitidos.includes(String(tipo))) return res.status(400).json({ error: `tipo inválido. Debe ser: ${tipoPermitidos.join(', ')}` });
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

    if (tipo) query = query.eq('tipo', String(tipo));
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

    const camposPermitidos = ['id_doctor', 'tipo', 'monto', 'descripcion', 'fecha', 'metodo_pago'];
    const recibidos = Object.keys(req.body || {});
    if (recibidos.length === 0) return res.status(400).json({ error: 'Debes enviar al menos un campo para actualizar' });
    const noPermitidos = recibidos.filter((c) => !camposPermitidos.includes(c));
    if (noPermitidos.length > 0) return res.status(400).json({ error: `Campos no permitidos: ${noPermitidos.join(', ')}` });

    const { data: existing, error: fetchErr } = await supabaseUser.from('movimiento_finanzas').select('*').eq('id', Number(id)).maybeSingle();
    if (fetchErr) return res.status(500).json({ error: fetchErr.message || fetchErr });
    if (!existing) return res.status(404).json({ error: 'Movimiento no encontrado' });

    const updates = {};
    const { id_doctor, tipo, monto, descripcion, fecha, metodo_pago } = req.body;
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
    if (metodo_pago !== undefined) {
      if (metodo_pago === null || String(metodo_pago).trim() === '') {
        updates.metodo_pago = null;
      } else {
        const mpNorm = normalizeMetodoPago(metodo_pago);
        if (mpNorm === null) return res.status(400).json({ error: `metodo_pago inválido. Debe ser uno de: efectivo, transferencia, tarjeta, deposito` });
        updates.metodo_pago = mpNorm;
        // Si el metodo es deposito, forzamos tipo egreso para que descuente efectivo
        if (updates.metodo_pago === 'deposito') updates.tipo = 'egreso';
      }
    }

    if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No hay campos válidos para actualizar' });

    const { data, error } = await supabaseUser.from('movimiento_finanzas').update(updates).eq('id', Number(id)).select().maybeSingle();
    if (error) return res.status(400).json({ error: error.message || error });

    // actualizar totales de caja para el periodo afectado
    try {
      const fechaAffected = (updates.fecha !== undefined) ? updates.fecha : data.fecha;
      const sedeId = data.sede_id || (req.body && req.body.sede_id) || null;
      if (fechaAffected && sedeId) {
        const parts = String(fechaAffected).split('-');
        const y = Number(parts[0]);
        const m = Number(parts[1]);
        if (!Number.isNaN(y) && !Number.isNaN(m)) await actualizarTotalesCajaParaPeriodo(supabaseUser, sedeId, y, m);
      }
    } catch (e) {
      console.error('Error actualizando totales de caja tras actualizar movimiento', e);
    }

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

    // actualizar totales de caja para el periodo del movimiento eliminado
    try {
      if (existing && existing.fecha && existing.sede_id) {
        const parts = String(existing.fecha).split('-');
        const y = Number(parts[0]);
        const m = Number(parts[1]);
        if (!Number.isNaN(y) && !Number.isNaN(m)) await actualizarTotalesCajaParaPeriodo(supabaseUser, existing.sede_id, y, m);
      }
    } catch (e) {
      console.error('Error actualizando totales de caja tras eliminar movimiento', e);
    }

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
