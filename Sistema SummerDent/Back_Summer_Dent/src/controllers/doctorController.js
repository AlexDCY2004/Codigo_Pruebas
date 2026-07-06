import { getSupabaseClientWithToken } from '../configuracionesDB/supabaseClient.js';
import { getPerfilFromToken } from '../utils/perfilUtils.js';
import { getAuthTokenFromReq } from '../utils/authUtils.js';

const estadosPermitidos = ['disponible', 'no disponible', 'eventual'];
const correoRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const telefonoRegex = /^\d{10}$/;
const telefonoRepetidosRegex = /(\d)\1{3,}/; // detecta 4 o más dígitos iguales consecutivos
const nombreRegex = /^[A-Za-zÁÉÍÓÚáéíóúÑñ.\s'-]+$/;

const esIdValido = (id) => /^\d+$/.test(String(id || '').trim()) && Number(String(id).trim()) > 0;

const esTextoValido = (valor, min, max) => {
    if (typeof valor !== 'string') return false;
    const limpio = valor.trim();
    return limpio.length >= min && limpio.length <= max;
};

const esCorreoValido = (correo) => {
    if (typeof correo !== 'string') return false;
    const limpio = correo.trim().toLowerCase();
    return limpio.length >= 5 && limpio.length <= 64 && correoRegex.test(limpio);
};

const esTelefonoValido = (telefono) => {
    if (telefono === undefined || telefono === null || telefono === '') return true;
    if (typeof telefono !== 'string' && typeof telefono !== 'number') return false;
    const limpio = String(telefono).trim();
    if (!telefonoRegex.test(limpio)) return false;
    if (telefonoRepetidosRegex.test(limpio)) return false;
    return true;
};

const esNombreValido = (nombre) => {
    if (typeof nombre !== 'string') return false;
    return nombreRegex.test(nombre.trim());
};

export const crearDoctorController = async (req, res) => {
    try {
        const token = getAuthTokenFromReq(req);
        if (!token) return res.status(401).json({ error: 'Token no proporcionado' });

        const supabaseUser = getSupabaseClientWithToken(token);

        const { nombre, telefono, correo, especialidad, estado } = req.body;

        if (typeof req.body !== 'object' || req.body === null || Array.isArray(req.body)) {
            return res.status(400).json({ error: 'El cuerpo de la solicitud debe ser un objeto JSON valido' });
        }

        if (!nombre || !correo || !especialidad) {
            return res.status(400).json({ error: 'Nombre, correo y especialidad son requeridos' });
        }

        if (telefono === undefined || telefono === null || String(telefono).trim() === '') {
            return res.status(400).json({ error: 'El telefono es obligatorio' });
        }

        if (!esTextoValido(nombre, 2, 64)) {
            return res.status(400).json({ error: 'El nombre debe tener entre 2 y 64 caracteres' });
        }

        if (!esNombreValido(nombre)) {
            return res.status(400).json({ error: 'El nombre solo debe contener letras, espacios y puntos' });
        }

        if (!esCorreoValido(correo)) {
            return res.status(400).json({ error: 'El correo debe tener @' });
        }

        if (!esTextoValido(especialidad, 2, 64)) {
            return res.status(400).json({ error: 'La especialidad debe tener entre 2 y 64 caracteres' });
        }

        if (!esTelefonoValido(telefono)) {
            return res.status(400).json({ error: 'El telefono debe contener solo digitos, tener exactamente 10 dígitos y no puede tener más de 3 dígitos iguales consecutivos' });
        }

        if (typeof estado !== 'undefined' && typeof estado !== 'string') {
            return res.status(400).json({ error: 'El estado debe ser texto' });
        }

        if (estado && !estadosPermitidos.includes(String(estado).trim().toLowerCase())) {
            return res.status(400).json({ error: 'Estado inválido. Debe ser: disponible, no disponible o eventual' });
        }

        const perfil = await getPerfilFromToken(token);

        const insertObj = {
            nombre: String(nombre).trim(),
            telefono: telefono ? String(telefono).trim() : null,
            correo: String(correo).trim().toLowerCase(),
            especialidad: String(especialidad).trim(),
            estado: estado ? String(estado).trim().toLowerCase() : 'disponible'
        };

        if (perfil && perfil.rol === 'superadmin') {
            if (req.body && req.body.sede_id) insertObj.sede_id = Number(req.body.sede_id);
        } else if (perfil && perfil.sede_id) {
            insertObj.sede_id = perfil.sede_id;
        }

        const { data, error } = await supabaseUser.from('doctor').insert([insertObj]).select().single();

        if (error) {
            const errMsg = String(error?.message || '');
            const errCode = String(error?.code || '');
            if (errCode === '23505' || errMsg.includes('doctor_correo_key')) {
                return res.status(409).json({ error: 'Este correo ya se encuentra agregado' });
            }
            return res.status(400).json({ error: errMsg || error });
        }

        return res.status(201).json({ mensaje: 'Doctor creado exitosamente', doctor: data });
    } catch (error) {
        return res.status(500).json({ error: error.message || error });
    }
};

export const obtenerDoctoresController = async (_req, res) => {
    try {
        const token = getAuthTokenFromReq(_req);
        if (!token) return res.status(401).json({ error: 'Token no proporcionado' });
        const supabaseUser = getSupabaseClientWithToken(token);

        const sedeId = _req && _req.query ? _req.query.sede_id : null;
        let query = supabaseUser.from('doctor').select('*').order('id', { ascending: false });
        if (sedeId !== undefined && sedeId !== null && String(sedeId).trim() !== '') {
            const sid = Number(sedeId);
            if (!Number.isNaN(sid)) query = query.eq('sede_id', sid);
        }

        const { data, error } = await query;

        if (error) return res.status(500).json({ error: error.message });

        return res.json(data);
    } catch (error) {
        return res.status(500).json({ error: error.message || error });
    }
};

export const obtenerDoctorPorIdController = async (req, res) => {
    try {
        const token = getAuthTokenFromReq(req);
        if (!token) return res.status(401).json({ error: 'Token no proporcionado' });
        const supabaseUser = getSupabaseClientWithToken(token);

        const { id } = req.params;

        if (!esIdValido(id)) {
            return res.status(400).json({ error: 'El id debe ser un numero entero positivo' });
        }

        const { data, error } = await supabaseUser
            .from('doctor')
            .select('*')
            .eq('id', id)
            .maybeSingle();

        if (error) return res.status(500).json({ error: error.message });
        if (!data) return res.status(404).json({ error: 'Doctor no encontrado' });

        return res.json(data);
    } catch (error) {
        return res.status(500).json({ error: error.message || error });
    }
};

export const actualizarDoctorController = async (req, res) => {
    try {
        const token = getAuthTokenFromReq(req);
        if (!token) return res.status(401).json({ error: 'Token no proporcionado' });
        const supabaseUser = getSupabaseClientWithToken(token);

        const { id } = req.params;
        const { nombre, telefono, correo, especialidad, estado, sede_id } = req.body;

        if (!esIdValido(id)) {
            return res.status(400).json({ error: 'El id debe ser un numero entero positivo' });
        }

        if (typeof req.body !== 'object' || req.body === null || Array.isArray(req.body)) {
            return res.status(400).json({ error: 'El cuerpo de la solicitud debe ser un objeto JSON valido' });
        }

        const camposPermitidos = ['nombre', 'telefono', 'correo', 'especialidad', 'estado', 'sede_id'];
        const camposRecibidos = Object.keys(req.body || {});

        if (camposRecibidos.length === 0) {
            return res.status(400).json({ error: 'Debes enviar al menos un campo para actualizar' });
        }

        const camposNoPermitidos = camposRecibidos.filter((campo) => !camposPermitidos.includes(campo));
        if (camposNoPermitidos.length > 0) {
            return res.status(400).json({ error: `Campos no permitidos: ${camposNoPermitidos.join(', ')}` });
        }

        if (nombre !== undefined && !esTextoValido(nombre, 2, 64)) return res.status(400).json({ error: 'El nombre debe tener entre 2 y 64 caracteres' });
        if (nombre !== undefined && !esNombreValido(nombre)) return res.status(400).json({ error: 'El nombre solo debe contener letras, espacios y puntos' });
        if (correo !== undefined && !esCorreoValido(correo)) return res.status(400).json({ error: 'El correo debe tener formato valido y entre 5 y 64 caracteres' });
        if (especialidad !== undefined && !esTextoValido(especialidad, 2, 64)) return res.status(400).json({ error: 'La especialidad debe tener entre 2 y 64 caracteres' });
        if (telefono !== undefined && !esTelefonoValido(telefono)) return res.status(400).json({ error: 'El telefono debe contener solo digitos, tener exactamente 10 caracteres y no puede tener más de 3 dígitos iguales consecutivos' });
        if (estado !== undefined && typeof estado !== 'string') return res.status(400).json({ error: 'El estado debe ser texto' });

        // Validaciones simples
        if (nombre !== undefined && !String(nombre).trim()) return res.status(400).json({ error: 'El nombre no puede estar vacío' });
        if (correo !== undefined && !String(correo).trim()) return res.status(400).json({ error: 'El correo no puede estar vacío' });
        if (especialidad !== undefined && !String(especialidad).trim()) return res.status(400).json({ error: 'La especialidad no puede estar vacía' });
        if (estado !== undefined && !estadosPermitidos.includes(String(estado).trim().toLowerCase())) return res.status(400).json({ error: 'Estado inválido. Debe ser: disponible, no disponible o eventual' });

        const updates = {};
        if (nombre !== undefined) updates.nombre = String(nombre).trim();
        if (telefono !== undefined) updates.telefono = telefono ? String(telefono).trim() : null;
        if (correo !== undefined) updates.correo = String(correo).trim().toLowerCase();
        if (especialidad !== undefined) updates.especialidad = String(especialidad).trim();
        if (estado !== undefined) updates.estado = String(estado).trim().toLowerCase();

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'No hay campos validos para actualizar' });
        }

        const { data, error } = await supabaseUser
            .from('doctor')
            .update(updates)
            .eq('id', id)
            .select()
            .maybeSingle();

        if (error) {
            const errMsg = String(error?.message || '');
            const errCode = String(error?.code || '');
            if (errCode === '23505' || errMsg.includes('doctor_correo_key')) {
                return res.status(409).json({ error: 'Este correo ya se encuentra agregado' });
            }
            return res.status(400).json({ error: errMsg || error });
        }
        if (!data) return res.status(404).json({ error: 'Doctor no encontrado' });

        return res.json({ mensaje: 'Doctor actualizado exitosamente', doctor: data });
    } catch (error) {
        return res.status(500).json({ error: error.message || error });
    }
};

export const eliminarDoctorController = async (req, res) => {
    try {
        const token = getAuthTokenFromReq(req);
        if (!token) return res.status(401).json({ error: 'Token no proporcionado' });
        const supabaseUser = getSupabaseClientWithToken(token);

        const { id } = req.params;

        if (!esIdValido(id)) {
            return res.status(400).json({ error: 'El id debe ser un numero entero positivo' });
        }

        const { data: existing, error: fetchErr } = await supabaseUser
            .from('doctor')
            .select('id')
            .eq('id', id)
            .maybeSingle();

        if (fetchErr) return res.status(500).json({ error: fetchErr.message });
        if (!existing) return res.status(404).json({ error: 'Doctor no encontrado' });

        const { error } = await supabaseUser.from('doctor').delete().eq('id', id);
        if (error) return res.status(500).json({ error: error.message || error });

        return res.json({ mensaje: 'Doctor eliminado exitosamente' });
    } catch (error) {
        return res.status(500).json({ error: error.message || error });
    }
};
