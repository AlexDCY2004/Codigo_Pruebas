import { getSupabaseClientWithToken } from '../configuracionesDB/supabaseClient.js';
import { getAuthTokenFromReq } from '../utils/authUtils.js';

const getTokenFromReq = (req) => getAuthTokenFromReq(req);

export const obtenerSedesController = async (req, res) => {
    try {
        const token = getAuthTokenFromReq(req);
        if (!token) return res.status(401).json({ error: 'Token no proporcionado' });
        const supabaseUser = getSupabaseClientWithToken(token);

        const { data, error } = await supabaseUser.from('sede').select('*').order('id', { ascending: true });
        if (error) return res.status(500).json({ error: error.message || error });
        return res.json(data);
    } catch (error) {
        return res.status(500).json({ error: error.message || error });
    }
};

export const obtenerSedePorIdController = async (req, res) => {
    try {
        const token = getAuthTokenFromReq(req);
        if (!token) return res.status(401).json({ error: 'Token no proporcionado' });
        const supabaseUser = getSupabaseClientWithToken(token);

        const { id } = req.params;
        const { data, error } = await supabaseUser.from('sede').select('*').eq('id', id).maybeSingle();
        if (error) return res.status(500).json({ error: error.message || error });
        if (!data) return res.status(404).json({ error: 'Sede no encontrada' });
        return res.json(data);
    } catch (error) {
        return res.status(500).json({ error: error.message || error });
    }
};

export const crearSedeController = async (req, res) => {
    try {
        const token = getAuthTokenFromReq(req);
        if (!token) return res.status(401).json({ error: 'Token no proporcionado' });
        const supabaseUser = getSupabaseClientWithToken(token);

        const { nombre, ciudad, direccion, telefono } = req.body;
        if (!nombre || !String(nombre).trim()) return res.status(400).json({ error: 'El nombre de la sede es obligatorio' });

        const payload = {
            nombre: String(nombre).trim(),
            ciudad: ciudad ? String(ciudad).trim() : null,
            direccion: direccion ? String(direccion).trim() : null,
            telefono: telefono ? String(telefono).trim() : null
        };

        const { data, error } = await supabaseUser.from('sede').insert([payload]).select().maybeSingle();
        if (error) return res.status(400).json({ error: error.message || error });
        return res.status(201).json({ mensaje: 'Sede creada', sede: data });
    } catch (error) {
        return res.status(500).json({ error: error.message || error });
    }
};

export const actualizarSedeController = async (req, res) => {
    try {
        const token = getAuthTokenFromReq(req);
        if (!token) return res.status(401).json({ error: 'Token no proporcionado' });
        const supabaseUser = getSupabaseClientWithToken(token);

        const { id } = req.params;
        const { nombre, ciudad, direccion, telefono } = req.body;

        const { data: existing, error: fetchErr } = await supabaseUser.from('sede').select('id').eq('id', id).maybeSingle();
        if (fetchErr) return res.status(500).json({ error: fetchErr.message || fetchErr });
        if (!existing) return res.status(404).json({ error: 'Sede no encontrada' });

        const updates = {};
        if (nombre !== undefined) updates.nombre = nombre !== null ? String(nombre).trim() : null;
        if (ciudad !== undefined) updates.ciudad = ciudad !== null ? String(ciudad).trim() : null;
        if (direccion !== undefined) updates.direccion = direccion !== null ? String(direccion).trim() : null;
        if (telefono !== undefined) updates.telefono = telefono !== null ? String(telefono).trim() : null;

        if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No hay campos para actualizar' });

        const { data, error } = await supabaseUser.from('sede').update(updates).eq('id', id).select().maybeSingle();
        if (error) return res.status(400).json({ error: error.message || error });
        return res.json({ mensaje: 'Sede actualizada', sede: data });
    } catch (error) {
        return res.status(500).json({ error: error.message || error });
    }
};

export const eliminarSedeController = async (req, res) => {
    try {
        const token = getTokenFromReq(req);
        if (!token) return res.status(401).json({ error: 'Token no proporcionado' });
        const supabaseUser = getSupabaseClientWithToken(token);

        const { id } = req.params;
        const { data: existing, error: fetchErr } = await supabaseUser.from('sede').select('id').eq('id', id).maybeSingle();
        if (fetchErr) return res.status(500).json({ error: fetchErr.message || fetchErr });
        if (!existing) return res.status(404).json({ error: 'Sede no encontrada' });

        const { error } = await supabaseUser.from('sede').delete().eq('id', id);
        if (error) return res.status(500).json({ error: error.message || error });
        return res.json({ mensaje: 'Sede eliminada' });
    } catch (error) {
        return res.status(500).json({ error: error.message || error });
    }
};
