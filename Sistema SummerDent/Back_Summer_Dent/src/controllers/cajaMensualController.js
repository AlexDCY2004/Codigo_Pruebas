import { getSupabaseClientWithToken, supabaseAdmin } from '../configuracionesDB/supabaseClient.js';
import { getPerfilFromToken } from '../utils/perfilUtils.js';
import { getAuthTokenFromReq } from '../utils/authUtils.js';
import { actualizarTotalesCajaParaPeriodo } from './movimientoFinanzasController.js';

const esEnteroPositivo = (v) => /^\d+$/.test(String(v || '').trim()) && Number(String(v).trim()) > 0;
const esAnioValido = (a) => /^\d{4}$/.test(String(a || ''));
const esMesValido = (m) => /^\d{1,2}$/.test(String(m || '')) && Number(m) >= 1 && Number(m) <= 12;
const esDecimalNoNegativo = (n) => {
  if (n === undefined || n === null) return false;
  const s = String(n).trim();
  if (!/^-?\d+(\.\d{1,2})?$/.test(s)) return false;
  return Number.isFinite(Number(s)) && Number(s) >= 0;
};

const getCurrentYearMonth = () => {
  const d = new Date();
  return { anio: d.getFullYear(), mes: d.getMonth() + 1 };
};

export const obtenerCajaActualController = async (req, res) => {
  try {
    const token = getAuthTokenFromReq(req);
    if (!token) return res.status(401).json({ error: 'Token no proporcionado' });
    const supabaseUser = getSupabaseClientWithToken(token);

    const perfil = await getPerfilFromToken(token);
    const queryAnio = req.query?.anio;
    const queryMes = req.query?.mes;
    let { anio, mes } = (queryAnio && queryMes && esAnioValido(queryAnio) && esMesValido(queryMes))
      ? { anio: Number(queryAnio), mes: Number(queryMes) }
      : getCurrentYearMonth();

    let sedeToUse = null;
    if (perfil && perfil.rol === 'superadmin') {
      if (req.query && req.query.sede_id) sedeToUse = Number(req.query.sede_id);
    } else if (perfil && perfil.sede_id) {
      sedeToUse = perfil.sede_id;
    }

    if (!sedeToUse) return res.status(400).json({ error: 'sede_id no determinado' });

    const { data, error } = await supabaseUser
      .from('caja_mensual')
      .select('*, sede(*)')
      .eq('sede_id', Number(sedeToUse))
      .eq('anio', Number(anio))
      .eq('mes', Number(mes))
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message || error });
    return res.json(data || null);
  } catch (error) {
    return res.status(500).json({ error: error.message || error });
  }
};

export const obtenerHistorialController = async (req, res) => {
  try {
    const token = getAuthTokenFromReq(req);
    if (!token) return res.status(401).json({ error: 'Token no proporcionado' });
    const supabaseUser = getSupabaseClientWithToken(token);

    const perfil = await getPerfilFromToken(token);
    let sedeToUse = null;
    if (perfil && perfil.rol === 'superadmin') {
      if (req.query && req.query.sede_id) sedeToUse = Number(req.query.sede_id);
    } else if (perfil && perfil.sede_id) {
      sedeToUse = perfil.sede_id;
    }

    if (!sedeToUse) return res.status(400).json({ error: 'sede_id no determinado' });

    const { data, error } = await supabaseUser
      .from('caja_mensual')
      .select('*, sede(*)')
      .eq('sede_id', Number(sedeToUse))
      .order('anio', { ascending: false })
      .order('mes', { ascending: false });

    if (error) return res.status(500).json({ error: error.message || error });
    return res.json(data || []);
  } catch (error) {
    return res.status(500).json({ error: error.message || error });
  }
};

export const crearCajaController = async (req, res) => {
  try {
    const token = getAuthTokenFromReq(req);
    if (!token) return res.status(401).json({ error: 'Token no proporcionado' });
    const supabaseUser = getSupabaseClientWithToken(token);

    const perfil = await getPerfilFromToken(token);
    let sedeToUse = null;
    if (perfil && perfil.rol === 'superadmin') {
      if (req.body && req.body.sede_id) sedeToUse = Number(req.body.sede_id);
    } else if (perfil && perfil.sede_id) {
      sedeToUse = perfil.sede_id;
    }

    if (!sedeToUse) return res.status(400).json({ error: 'sede_id no determinado' });

    const { anio, mes, saldo_inicial } = req.body || {};
    if (!esAnioValido(anio)) return res.status(400).json({ error: 'anio inválido' });
    if (!esMesValido(mes)) return res.status(400).json({ error: 'mes inválido' });
    if (!esDecimalNoNegativo(saldo_inicial)) return res.status(400).json({ error: 'saldo_inicial inválido' });

    const payload = {
      sede_id: Number(sedeToUse),
      id_perfil: perfil ? perfil.id : null,
      anio: Number(anio),
      mes: Number(mes),
      saldo_inicial: Number(Number(saldo_inicial).toFixed(2)),
      total_ingresos: 0,
      total_egresos: 0,
      observacion: req.body?.observacion || null,
      cerrado: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabaseUser.from('caja_mensual').insert([payload]).select().maybeSingle();
    if (error) return res.status(400).json({ error: error.message || error });
    // After creating, recalculate totals in case there are existing movements
    try {
      await actualizarTotalesCajaParaPeriodo(supabaseUser, Number(sedeToUse), Number(anio), Number(mes));
    } catch (e) {
      console.error('Error actualizando totales tras crear caja:', e);
    }
    return res.status(201).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message || error });
  }
};

export const actualizarCajaController = async (req, res) => {
  try {
    const token = getAuthTokenFromReq(req);
    if (!token) return res.status(401).json({ error: 'Token no proporcionado' });
    const supabaseUser = getSupabaseClientWithToken(token);

    const { id } = req.params;
    if (!esEnteroPositivo(id)) return res.status(400).json({ error: 'id inválido' });

    const { data: existing, error: fetchErr } = await supabaseUser.from('caja_mensual').select('*').eq('id', Number(id)).maybeSingle();
    if (fetchErr) return res.status(500).json({ error: fetchErr.message || fetchErr });
    if (!existing) return res.status(404).json({ error: 'Registro no encontrado' });
    if (existing.cerrado) return res.status(400).json({ error: 'No se puede modificar una caja cerrada' });

    const updates = {};
    const { saldo_inicial, observacion } = req.body || {};
    if (saldo_inicial !== undefined) {
      if (!esDecimalNoNegativo(saldo_inicial)) return res.status(400).json({ error: 'saldo_inicial inválido' });
      updates.saldo_inicial = Number(Number(saldo_inicial).toFixed(2));
    }
    if (observacion !== undefined) updates.observacion = observacion || null;

    if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No hay campos para actualizar' });

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabaseUser.from('caja_mensual').update(updates).eq('id', Number(id)).select().maybeSingle();
    if (error) return res.status(400).json({ error: error.message || error });

    // After updating saldo_inicial (or other fields), recalculate totals for the period
    // so any generated/computed `saldo_final` or aggregates reflect current values.
    try {
      const sid = data?.sede_id || existing.sede_id;
      const y = data?.anio || existing.anio;
      const m = data?.mes || existing.mes;
      if (sid && y && m) {
        await actualizarTotalesCajaParaPeriodo(supabaseUser, Number(sid), Number(y), Number(m));
      }
    } catch (e) {
      // don't fail the request if recalculation fails
      console.error('Error al recalcular totales tras actualizar caja:', e);
    }

    // Re-fetch the caja_mensual record after recalculation so generated `saldo_final`
    // and related fields are returned to the client with current values.
    try {
      const { data: refreshed, error: refErr } = await supabaseUser
        .from('caja_mensual')
        .select('*, sede(*)')
        .eq('id', Number(id))
        .maybeSingle();
      if (!refErr && refreshed) return res.json(refreshed);
    } catch (e) {
      console.error('Error al obtener caja actualizada:', e);
    }

    return res.json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message || error });
  }
};

export const cerrarCajaController = async (req, res) => {
  try {
    const token = getAuthTokenFromReq(req);
    if (!token) return res.status(401).json({ error: 'Token no proporcionado' });
    const supabaseUser = getSupabaseClientWithToken(token);

    const { id } = req.params;
    if (!esEnteroPositivo(id)) return res.status(400).json({ error: 'id inválido' });

    const { data: existing, error: fetchErr } = await supabaseUser.from('caja_mensual').select('*').eq('id', Number(id)).maybeSingle();
    if (fetchErr) return res.status(500).json({ error: fetchErr.message || fetchErr });
    if (!existing) return res.status(404).json({ error: 'Registro no encontrado' });
    if (existing.cerrado) return res.status(400).json({ error: 'Caja ya está cerrada' });

    // Ensure totals are up to date before computing saldo_final
    try {
      if (existing && existing.sede_id && existing.anio && existing.mes) {
        await actualizarTotalesCajaParaPeriodo(supabaseUser, existing.sede_id, existing.anio, existing.mes);
        // re-fetch existing to get updated totals if any
        const { data: refreshed, error: refErr } = await supabaseUser.from('caja_mensual').select('*').eq('id', Number(id)).maybeSingle();
        if (!refErr && refreshed) existing = refreshed;
      }
    } catch (e) {
      console.error('Error actualizando totales antes de cerrar caja:', e);
    }

    // calcular saldo_final: si columna generada existe, usarla; si no, calcular
    const saldoFinal = existing.saldo_final !== null && existing.saldo_final !== undefined
      ? Number(existing.saldo_final)
      : Number((Number(existing.saldo_inicial || 0) + Number(existing.total_ingresos || 0) - Number(existing.total_egresos || 0)).toFixed(2));

    // marcar como cerrado
    const { data: closed, error: closeErr } = await supabaseUser.from('caja_mensual').update({ cerrado: true, updated_at: new Date().toISOString() }).eq('id', Number(id)).select().maybeSingle();
    if (closeErr) return res.status(500).json({ error: closeErr.message || closeErr });

    // crear registro del siguiente mes si no existe
    let nextAnio = Number(existing.anio);
    let nextMes = Number(existing.mes) + 1;
    if (nextMes > 12) { nextMes = 1; nextAnio += 1; }

    const { data: existsNext, error: existsErr } = await supabaseUser.from('caja_mensual').select('*').eq('sede_id', existing.sede_id).eq('anio', nextAnio).eq('mes', nextMes).maybeSingle();
    if (existsErr) return res.status(500).json({ error: existsErr.message || existsErr });

    let createdNext = null;
    if (!existsNext) {
      const toInsert = {
        sede_id: existing.sede_id,
        id_perfil: token ? (await getPerfilFromToken(token))?.id : null,
        anio: nextAnio,
        mes: nextMes,
        saldo_inicial: Number(Number(saldoFinal).toFixed(2)),
        total_ingresos: 0,
        total_egresos: 0,
        observacion: null,
        cerrado: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data: created, error: createErr } = await supabaseUser.from('caja_mensual').insert([toInsert]).select().maybeSingle();
      if (createErr) return res.status(500).json({ error: createErr.message || createErr });
      createdNext = created;
    }

    return res.json({ closed: closed || existing, next: createdNext });
  } catch (error) {
    return res.status(500).json({ error: error.message || error });
  }
};

export default {
  obtenerCajaActualController,
  obtenerHistorialController,
  crearCajaController,
  actualizarCajaController,
  cerrarCajaController
};
