import { supabase, supabaseAdmin, getSupabaseClientWithToken } from '../configuracionesDB/supabaseClient.js';
import { getPerfilFromToken } from '../utils/perfilUtils.js';
import { getAuthTokenFromReq } from '../utils/authUtils.js';

const AREAS_PERMITIDAS = [
  'Odontología General',
  'Ortodoncia',
  'Ortopedia',
  'Cirugía Odontológica',
  'Endodoncia',
  'Prótesis Removible Valplast o Flexible',
  'Acrílicas',
  'Prótesis Cromo Cobalto'
];
const esIdValido = (id) => /^\d+$/.test(String(id || '').trim()) && Number(String(id).trim()) > 0;

const esTextoValido = (valor, min, max) => {
  if (typeof valor !== 'string') return false;
  const limpio = valor.trim();
  return limpio.length >= min && limpio.length <= max;
};

const esNombreTratamientoValido = (nombre) => {
  if (typeof nombre !== 'string') return false;
  const limpio = nombre.trim();
  if (limpio.length === 0 || limpio.length > 64) return false;
  // debe contener al menos 5 letras (no solo números)
  const letras = (limpio.match(/[A-Za-zÁÉÍÓÚáéíóúÑñ]/g) || []).length;
  if (letras < 5) return false;
  // permitir letras, números, espacios y puntuación básica
  if (!/^[A-Za-z0-9ÁÉÍÓÚáéíóúÑñ\s\-\.,]+$/.test(limpio)) return false;
  return true;
};


const esAreaValida = (area) => {
  if (typeof area !== 'string') return false;
  const limpia = area.trim();
  return AREAS_PERMITIDAS.includes(limpia) && limpia.length <= 64;
};

const esPrecioValido = (precio) => {
  if (precio === undefined || precio === null || precio === '') return false;
  const limpio = String(precio).trim();
  // Allow decimals with up to 2 decimal places (e.g. 123, 123.4, 123.45)
  if (!/^\d+(\.\d{1,2})?$/.test(limpio)) return false;
  const valor = Number(limpio);
  if (!Number.isFinite(valor)) return false;
  if (valor <= 0 || valor > 99999999) return false;
  return true;
};

const esDescripcionValida = (descripcion) => {
  if (descripcion === undefined || descripcion === null || descripcion === '') return true;
  if (typeof descripcion !== 'string') return false;
  return descripcion.trim().length <= 300;
};

const getTokenFromHeader = (req) => {
  return getAuthTokenFromReq(req);
};

const checkAdmin = async (token) => {
  const perfil = await getPerfilFromToken(token);
  if (!perfil) return null;
  // permitir administrador o superadmin (superadmin puede gestionar cualquier sede)
  if (perfil.rol === 'administrador' || perfil.rol === 'superadmin') return perfil;
  return null;
};

export const crearTratamientoController = async (req, res) => {
  try {
    const token = getTokenFromHeader(req);
    if (!token) return res.status(401).json({ error: 'Token no proporcionado' });

    const perfil = await checkAdmin(token);
    if (!perfil) return res.status(403).json({ error: 'Acceso denegado. Se requieren permisos de administrador o superadmin' });

    const supabaseUser = getSupabaseClientWithToken(token);
    const { area, nombre, precio, descripcion } = req.body;

    if (typeof req.body !== 'object' || req.body === null || Array.isArray(req.body)) {
      return res.status(400).json({ error: 'El cuerpo de la solicitud debe ser un objeto JSON valido' });
    }

    if (!area || !String(area).trim()) return res.status(400).json({ error: 'El área es obligatoria' });
    if (!nombre || !String(nombre).trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });
    if (precio === undefined || precio === null) return res.status(400).json({ error: 'El precio es obligatorio' });

    if (!esAreaValida(area)) return res.status(400).json({ error: `El área es inválida. Debe ser una de: ${AREAS_PERMITIDAS.join(', ')}` });
    if (!esNombreTratamientoValido(nombre)) return res.status(400).json({ error: 'El nombre debe contener al menos 5 letras, puede incluir números y tener hasta 64 caracteres' });
    if (!esPrecioValido(precio)) return res.status(400).json({ error: 'El precio debe ser un número positivo (puede tener decimales)' });
    if (!esDescripcionValida(descripcion)) return res.status(400).json({ error: 'La descripción no debe exceder 300 caracteres' });

    const insertObj = {
      area: String(area).trim(),
      nombre: String(nombre).trim(),
      precio: precio,
      descripcion: descripcion ? String(descripcion).trim() : null
    };
    // asignar sede_id: si es superadmin puede pasar sede_id en body, si es administrador usar su sede
    if (perfil.rol === 'superadmin') {
      if (req.body && req.body.sede_id) insertObj.sede_id = Number(req.body.sede_id);
    } else if (perfil.sede_id) {
      insertObj.sede_id = perfil.sede_id;
    }

    const { data, error } = await supabaseUser.from('tratamiento').insert([insertObj]).select().maybeSingle();

    if (error) return res.status(400).json({ error: error.message || error });
    return res.status(201).json({ mensaje: 'Tratamiento creado', tratamiento: data });
  } catch (error) {
    return res.status(500).json({ error: error.message || error });
  }
};

export const obtenerTratamientosController = async (req, res) => {
  try {
    const token = getTokenFromHeader(req);
    if (!token) return res.status(401).json({ error: 'Token no proporcionado' });

    const supabaseUser = getSupabaseClientWithToken(token);
    const sedeId = req && req.query ? req.query.sede_id : null;
    let query = supabaseUser.from('tratamiento').select('*').order('id', { ascending: false });
    if (sedeId !== undefined && sedeId !== null && String(sedeId).trim() !== '') {
      const sid = Number(sedeId);
      if (!Number.isNaN(sid)) query = query.eq('sede_id', sid);
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message || error });
    return res.json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message || error });
  }
};

export const obtenerTratamientoPorIdController = async (req, res) => {
  try {
    const token = getTokenFromHeader(req);
    if (!token) return res.status(401).json({ error: 'Token no proporcionado' });

    const supabaseUser = getSupabaseClientWithToken(token);
    const { id } = req.params;

    if (!esIdValido(id)) return res.status(400).json({ error: 'El id debe ser un número entero positivo' });

    const { data, error } = await supabaseUser.from('tratamiento').select('*').eq('id', id).maybeSingle();
    if (error) return res.status(500).json({ error: error.message || error });
    if (!data) return res.status(404).json({ error: 'Tratamiento no encontrado' });
    return res.json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message || error });
  }
};

export const actualizarTratamientoController = async (req, res) => {
  try {
    const token = getTokenFromHeader(req);
    if (!token) return res.status(401).json({ error: 'Token no proporcionado' });

    const perfilAdmin = await checkAdmin(token);
    if (!perfilAdmin) return res.status(403).json({ error: 'Acceso denegado. Se requieren permisos de administrador o superadmin' });

    const supabaseUser = getSupabaseClientWithToken(token);
    const { id } = req.params;
    const { area, nombre, precio, descripcion, sede_id } = req.body;

    if (!esIdValido(id)) return res.status(400).json({ error: 'El id debe ser un número entero positivo' });

    if (typeof req.body !== 'object' || req.body === null || Array.isArray(req.body)) {
      return res.status(400).json({ error: 'El cuerpo de la solicitud debe ser un objeto JSON valido' });
    }

    const camposPermitidos = ['area', 'nombre', 'precio', 'descripcion', 'sede_id'];
    const camposRecibidos = Object.keys(req.body || {});

    if (camposRecibidos.length === 0) {
      return res.status(400).json({ error: 'Debes enviar al menos un campo para actualizar' });
    }

    const camposNoPermitidos = camposRecibidos.filter((campo) => !camposPermitidos.includes(campo));
    if (camposNoPermitidos.length > 0) {
      return res.status(400).json({ error: `Campos no permitidos: ${camposNoPermitidos.join(', ')}` });
    }

    if (area !== undefined && area !== null && !esAreaValida(area)) return res.status(400).json({ error: `El área es inválida. Debe ser una de: ${AREAS_PERMITIDAS.join(', ')}` });
    if (nombre !== undefined && !esNombreTratamientoValido(String(nombre))) return res.status(400).json({ error: 'El nombre debe contener al menos 5 letras, puede incluir números y tener hasta 64 caracteres' });
    if (precio !== undefined && !esPrecioValido(precio)) return res.status(400).json({ error: 'El precio debe ser un número positivo (puede tener decimales)' });
    if (descripcion !== undefined && !esDescripcionValida(descripcion)) return res.status(400).json({ error: 'La descripción no debe exceder 300 caracteres' });
    if (sede_id !== undefined && !esIdValido(sede_id)) return res.status(400).json({ error: 'El ID de la sede es inválido' });

    const { data: existing, error: fetchErr } = await supabaseUser.from('tratamiento').select('id').eq('id', id).maybeSingle();
    if (fetchErr) return res.status(500).json({ error: fetchErr.message || fetchErr });
    if (!existing) return res.status(404).json({ error: 'Tratamiento no encontrado' });

    const updates = {};
    if (area !== undefined) updates.area = area ? String(area).trim() : null;
    if (nombre !== undefined) updates.nombre = nombre ? String(nombre).trim() : null;
    if (precio !== undefined) updates.precio = precio;
    if (descripcion !== undefined) updates.descripcion = descripcion ? String(descripcion).trim() : null;
    if (sede_id !== undefined) updates.sede_id = sede_id;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No hay campos válidos para actualizar' });
    }

    const { data, error } = await supabaseUser.from('tratamiento').update(updates).eq('id', id).select().maybeSingle();
    if (error) return res.status(400).json({ error: error.message || error });
    return res.json({ mensaje: 'Tratamiento actualizado', tratamiento: data });
  } catch (error) {
    return res.status(500).json({ error: error.message || error });
  }
};

export const eliminarTratamientoController = async (req, res) => {
  try {
    const token = getTokenFromHeader(req);
    if (!token) return res.status(401).json({ error: 'Token no proporcionado' });

    const perfilAdmin2 = await checkAdmin(token);
    if (!perfilAdmin2) return res.status(403).json({ error: 'Acceso denegado. Se requieren permisos de administrador o superadmin' });

    const supabaseUser = getSupabaseClientWithToken(token);
    const { id } = req.params;

    if (!esIdValido(id)) return res.status(400).json({ error: 'El id debe ser un número entero positivo' });

    const { data: existing, error: fetchErr } = await supabaseUser.from('tratamiento').select('id').eq('id', id).maybeSingle();
    if (fetchErr) return res.status(500).json({ error: fetchErr.message || fetchErr });
    if (!existing) return res.status(404).json({ error: 'Tratamiento no encontrado' });

    const { error } = await supabaseUser.from('tratamiento').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message || error });

    return res.json({ mensaje: 'Tratamiento eliminado' });
  } catch (error) {
    return res.status(500).json({ error: error.message || error });
  }
};

export default {
  crearTratamientoController,
  obtenerTratamientosController,
  obtenerTratamientoPorIdController,
  actualizarTratamientoController,
  eliminarTratamientoController
};
