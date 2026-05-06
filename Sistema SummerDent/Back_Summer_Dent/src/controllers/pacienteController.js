import { supabaseAdmin, getSupabaseClientWithToken } from '../configuracionesDB/supabaseClient.js';

const cedulaRegex = /^\d{10}$/;
const telefonoRegex = /^\d{10}$/;
const correoRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const nombreRegex = /^[A-Za-zÁÉÍÓÚáéíóúÑñ]+(?:[ '\-][A-Za-zÁÉÍÓÚáéíóúÑñ]+)*$/;

const esTextoValido = (valor, min, max) => {
  if (typeof valor !== 'string') return false;
  const limpio = valor.trim();
  return limpio.length >= min && limpio.length <= max;
};

const esCedulaValida = (cedula) => {
  if (typeof cedula !== 'string' && typeof cedula !== 'number') return false;
  const limpia = String(cedula).trim();
  if (!cedulaRegex.test(limpia)) return false;

  const provincia = Number(limpia.slice(0, 2));
  const tercerDigito = Number(limpia[2]);

  if (provincia < 1 || provincia > 24) return false;
  if (tercerDigito < 0 || tercerDigito > 5) return false;

  const coeficientes = [2, 1, 2, 1, 2, 1, 2, 1, 2];
  let suma = 0;

  for (let i = 0; i < 9; i += 1) {
    let valor = Number(limpia[i]) * coeficientes[i];
    if (valor >= 10) valor -= 9;
    suma += valor;
  }

  const digitoVerificador = (10 - (suma % 10)) % 10;
  return digitoVerificador === Number(limpia[9]);
};

const esTelefonoValido = (telefono) => {
  if (telefono === undefined || telefono === null || telefono === '') return true;
  if (typeof telefono !== 'string' && typeof telefono !== 'number') return false;
  const limpio = String(telefono).trim();
  return telefonoRegex.test(limpio);
};

const esNombreValido = (valor) => {
  if (typeof valor !== 'string') return false;
  return nombreRegex.test(valor.trim());
};

const esCorreoValido = (correo) => {
  if (correo === undefined || correo === null || correo === '') return true;
  if (typeof correo !== 'string') return false;
  const limpio = correo.trim().toLowerCase();
  return limpio.length >= 5 && limpio.length <= 64 && correoRegex.test(limpio);
};

const esFechaNacimientoValida = (fecha) => {
  if (fecha === undefined || fecha === null || fecha === '') return false;
  if (typeof fecha !== 'string' && typeof fecha !== 'number' && !(fecha instanceof Date)) return false;

  const valor = String(fecha).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;

  const f = new Date(`${valor}T00:00:00`);
  if (Number.isNaN(f.getTime())) return false;

  const hoy = new Date();
  const hoySinHora = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  if (f > hoySinHora) return false;

  return true;
};

export const crearPacienteController = async (req, res) => {
  try {
    const token = (req.headers.authorization || '').startsWith('Bearer ') ? req.headers.authorization.replace('Bearer ', '').trim() : null;
    if (!token) return res.status(401).json({ error: 'Token no proporcionado' });

    const supabaseUser = getSupabaseClientWithToken(token);
    const { id_cedula, nombre, apellido, fecha_nacimiento, telefono, correo, direccion } = req.body;

    if (typeof req.body !== 'object' || req.body === null || Array.isArray(req.body)) {
      return res.status(400).json({ error: 'El cuerpo de la solicitud debe ser un objeto JSON valido' });
    }

    if (!id_cedula || !String(id_cedula).trim()) return res.status(400).json({ error: 'La cédula es obligatoria' });
    if (!nombre || !String(nombre).trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });
    if (!apellido || !String(apellido).trim()) return res.status(400).json({ error: 'El apellido es obligatorio' });

    if (!esCedulaValida(id_cedula)) return res.status(400).json({ error: 'Cédula inválida' });
    if (!esTextoValido(nombre, 2, 64)) return res.status(400).json({ error: 'El nombre debe tener entre 2 y 64 caracteres' });
    if (!esTextoValido(apellido, 2, 64)) return res.status(400).json({ error: 'El apellido debe tener entre 2 y 64 caracteres' });
    if (!esNombreValido(nombre)) return res.status(400).json({ error: 'El nombre solo debe contener letras y espacios' });
    if (!esNombreValido(apellido)) return res.status(400).json({ error: 'El apellido solo debe contener letras y espacios' });
    if (!esFechaNacimientoValida(fecha_nacimiento)) return res.status(400).json({ error: 'La fecha de nacimiento es obligatoria, debe estar en formato YYYY-MM-DD y no puede ser futura' });
    if (!esTelefonoValido(telefono)) return res.status(400).json({ error: 'El teléfono debe contener solo 10 dígitos' });
    if (!esCorreoValido(correo)) return res.status(400).json({ error: 'El correo debe tener @' });
    if (direccion !== undefined && direccion !== null && !esTextoValido(String(direccion), 1, 255)) return res.status(400).json({ error: 'La dirección no puede estar vacía y no debe exceder 255 caracteres' });

    // Verificar existencia (con token del usuario — RLS se aplicará)
    const { data: existente, error: existErr } = await supabaseUser
      .from('paciente')
      .select('id_cedula')
      .eq('id_cedula', String(id_cedula).trim())
      .maybeSingle();

    if (existErr) return res.status(500).json({ error: existErr.message });
    if (existente) return res.status(409).json({ error: 'Paciente con esa cédula ya existe' });

    const { data, error } = await supabaseUser
      .from('paciente')
      .insert([
        {
          id_cedula: String(id_cedula).trim(),
          nombre: String(nombre).trim(),
          apellido: String(apellido).trim(),
          fecha_nacimiento: fecha_nacimiento ? String(fecha_nacimiento) : null,
          telefono: telefono ? String(telefono).trim() : null,
          correo: correo ? String(correo).trim() : null,
          direccion: direccion ? String(direccion).trim() : null
        }
      ])
      .select()
      .maybeSingle();

    if (error) return res.status(400).json({ error: error.message || error });

    return res.status(201).json({ mensaje: 'Paciente creado', paciente: data });
  } catch (error) {
    return res.status(500).json({ error: error.message || error });
  }
};

export const obtenerPacientesController = async (req, res) => {
  try {
    const token = (req.headers.authorization || '').startsWith('Bearer ') ? req.headers.authorization.replace('Bearer ', '').trim() : null;
    if (!token) return res.status(401).json({ error: 'Token no proporcionado' });

    const supabaseUser = getSupabaseClientWithToken(token);
    const { data, error } = await supabaseUser.from('paciente').select('*').order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message || error });
    return res.json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message || error });
  }
};

export const obtenerPacientePorIdController = async (req, res) => {
  try {
    const token = (req.headers.authorization || '').startsWith('Bearer ') ? req.headers.authorization.replace('Bearer ', '').trim() : null;
    if (!token) return res.status(401).json({ error: 'Token no proporcionado' });

    const supabaseUser = getSupabaseClientWithToken(token);
    const { id } = req.params;

    if (!esCedulaValida(id)) return res.status(400).json({ error: 'El id debe ser una cédula ecuatoriana válida de 10 dígitos' });

    const { data, error } = await supabaseUser.from('paciente').select('*').eq('id_cedula', id).maybeSingle();
    if (error) return res.status(500).json({ error: error.message || error });
    if (!data) return res.status(404).json({ error: 'Paciente no encontrado' });
    return res.json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message || error });
  }
};

export const actualizarPacienteController = async (req, res) => {
  try {
    const token = (req.headers.authorization || '').startsWith('Bearer ') ? req.headers.authorization.replace('Bearer ', '').trim() : null;
    if (!token) return res.status(401).json({ error: 'Token no proporcionado' });

    const supabaseUser = getSupabaseClientWithToken(token);
    const { id } = req.params;
    const { id_cedula, nombre, apellido, fecha_nacimiento, telefono, correo, direccion } = req.body;

    if (!esCedulaValida(id)) return res.status(400).json({ error: 'El id debe ser una cédula ecuatoriana válida de 10 dígitos' });

    if (typeof req.body !== 'object' || req.body === null || Array.isArray(req.body)) {
      return res.status(400).json({ error: 'El cuerpo de la solicitud debe ser un objeto JSON valido' });
    }

    const camposPermitidos = ['id_cedula', 'nombre', 'apellido', 'fecha_nacimiento', 'telefono', 'correo', 'direccion'];
    const camposRecibidos = Object.keys(req.body || {});

    if (camposRecibidos.length === 0) {
      return res.status(400).json({ error: 'Debes enviar al menos un campo para actualizar' });
    }

    const camposNoPermitidos = camposRecibidos.filter((campo) => !camposPermitidos.includes(campo));
    if (camposNoPermitidos.length > 0) {
      return res.status(400).json({ error: `Campos no permitidos: ${camposNoPermitidos.join(', ')}` });
    }

    const { data: existing, error: fetchErr } = await supabaseUser.from('paciente').select('id_cedula').eq('id_cedula', id).maybeSingle();
    if (fetchErr) return res.status(500).json({ error: fetchErr.message || fetchErr });
    if (!existing) return res.status(404).json({ error: 'Paciente no encontrado' });

    const cedulaNueva = id_cedula !== undefined ? String(id_cedula).trim() : id;
    if (id_cedula !== undefined) {
      if (!esCedulaValida(id_cedula)) return res.status(400).json({ error: 'La nueva cédula debe ser una cédula ecuatoriana válida de 10 dígitos' });

      if (cedulaNueva !== id) {
        const { data: cedulaExistente, error: cedulaErr } = await supabaseUser
          .from('paciente')
          .select('id_cedula')
          .eq('id_cedula', cedulaNueva)
          .maybeSingle();

        if (cedulaErr) return res.status(500).json({ error: cedulaErr.message || cedulaErr });
        if (cedulaExistente) return res.status(409).json({ error: 'Ya existe un paciente con esa nueva cédula' });
      }
    }

    if (nombre !== undefined && !String(nombre).trim()) return res.status(400).json({ error: 'El nombre no puede estar vacío' });
    if (apellido !== undefined && !String(apellido).trim()) return res.status(400).json({ error: 'El apellido no puede estar vacío' });
    if (nombre !== undefined && !esTextoValido(nombre, 2, 64)) return res.status(400).json({ error: 'El nombre debe tener entre 2 y 64 caracteres' });
    if (apellido !== undefined && !esTextoValido(apellido, 2, 64)) return res.status(400).json({ error: 'El apellido debe tener entre 2 y 64 caracteres' });
    if (nombre !== undefined && !esNombreValido(nombre)) return res.status(400).json({ error: 'El nombre solo debe contener letras y espacios' });
    if (apellido !== undefined && !esNombreValido(apellido)) return res.status(400).json({ error: 'El apellido solo debe contener letras y espacios' });
    if (fecha_nacimiento !== undefined && fecha_nacimiento !== null && fecha_nacimiento !== '' && !esFechaNacimientoValida(fecha_nacimiento)) return res.status(400).json({ error: 'La fecha de nacimiento debe estar en formato YYYY-MM-DD y no puede ser futura' });
    if (telefono !== undefined && !esTelefonoValido(telefono)) return res.status(400).json({ error: 'El teléfono debe contener solo dígitos y tener exactamente 10 caracteres' });
    if (correo !== undefined && !esCorreoValido(correo)) return res.status(400).json({ error: 'El correo debe tener formato válido y entre 5 y 64 caracteres' });
    if (direccion !== undefined && direccion !== null && String(direccion).trim() && !esTextoValido(String(direccion), 1, 255)) return res.status(400).json({ error: 'La dirección no debe exceder 255 caracteres' });

    const updates = {};
    if (id_cedula !== undefined && cedulaNueva !== id) updates.id_cedula = cedulaNueva;
    if (nombre !== undefined) updates.nombre = String(nombre).trim();
    if (apellido !== undefined) updates.apellido = String(apellido).trim();
    if (fecha_nacimiento !== undefined) updates.fecha_nacimiento = fecha_nacimiento ? String(fecha_nacimiento) : null;
    if (telefono !== undefined) updates.telefono = telefono ? String(telefono).trim() : null;
    if (correo !== undefined) updates.correo = correo ? String(correo).trim() : null;
    if (direccion !== undefined) updates.direccion = direccion ? String(direccion).trim() : null;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No hay campos válidos para actualizar' });
    }

    const { data, error } = await supabaseAdmin.from('paciente').update(updates).eq('id_cedula', id).select().maybeSingle();
    if (error) return res.status(400).json({ error: error.message || error });

    return res.json({ mensaje: 'Paciente actualizado', paciente: data });
  } catch (error) {
    return res.status(500).json({ error: error.message || error });
  }
};

export const eliminarPacienteController = async (req, res) => {
  try {
    const token = (req.headers.authorization || '').startsWith('Bearer ') ? req.headers.authorization.replace('Bearer ', '').trim() : null;
    if (!token) return res.status(401).json({ error: 'Token no proporcionado' });

    const { id } = req.params;

    if (!esCedulaValida(id)) return res.status(400).json({ error: 'El id debe ser una cédula ecuatoriana válida de 10 dígitos' });

    const { data: existing, error: fetchErr } = await supabaseAdmin.from('paciente').select('id_cedula').eq('id_cedula', id).maybeSingle();
    if (fetchErr) return res.status(500).json({ error: fetchErr.message || fetchErr });
    if (!existing) return res.status(404).json({ error: 'Paciente no encontrado' });

    const { error: citasError } = await supabaseAdmin.from('cita').delete().eq('id_paciente', id);
    if (citasError) return res.status(500).json({ error: citasError.message || citasError });

    const { error } = await supabaseAdmin.from('paciente').delete().eq('id_cedula', id);
    if (error) return res.status(500).json({ error: error.message || error });

    return res.json({ mensaje: 'Paciente eliminado' });
  } catch (error) {
    return res.status(500).json({ error: error.message || error });
  }
};

export default {
  crearPacienteController,
  obtenerPacientesController,
  obtenerPacientePorIdController,
  actualizarPacienteController,
  eliminarPacienteController
};
