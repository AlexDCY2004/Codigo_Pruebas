import { getSupabaseClientWithToken } from '../configuracionesDB/supabaseClient.js';
import { getPerfilFromToken } from '../utils/perfilUtils.js';
import { getAuthTokenFromReq } from '../utils/authUtils.js';

const precioRegex = /^\d+(?:\.\d{1,2})?$/;
const nombreRegex = /^[A-Za-z0-9\u00C0-\u017F\s\-_\/]+$/;

const esPrecioValido = (precio) => {
    if (precio === undefined || precio === null || precio === '') return true;
    return precioRegex.test(String(precio).trim());
};

export const crearProductoController = async (req, res) => {
    try {
        const token = getAuthTokenFromReq(req);
        if (!token) return res.status(401).json({ error: 'Token no proporcionado' });
        const supabaseUser = getSupabaseClientWithToken(token);

        const { nombre, descripcion, categoria, precio } = req.body;

        // Campos base obligatorios
        if (!nombre || !String(nombre).trim()) return res.status(400).json({ error: 'El nombre del producto es obligatorio' });
        if (!nombreRegex.test(String(nombre).trim())) return res.status(400).json({ error: "El nombre contiene caracteres no permitidos" });
        if (!descripcion || !String(descripcion).trim()) return res.status(400).json({ error: 'La descripción es obligatoria' });
        if (!categoria || !String(categoria).trim()) return res.status(400).json({ error: 'La categoría es obligatoria' });
        if (precio === undefined || precio === null || String(precio).trim() === '') return res.status(400).json({ error: 'El precio es obligatorio' });
        if (!esPrecioValido(precio)) return res.status(400).json({ error: 'precio inválido (usa formato 0 o 0.00)' });

        // obtener perfil del usuario para determinar sede_id antes de crear el producto
        const perfil = await getPerfilFromToken(token);

        // 1) Crear producto (incluye precio y sede_id si se aplica)
        const productoPayload = {
            nombre: String(nombre).trim(),
            descripcion: descripcion ? String(descripcion).trim() : null,
            categoria: categoria ? String(categoria).trim() : null
        };
        if (precio !== undefined && precio !== null && precio !== '') {
            const parsedPrecio = Number(precio);
            if (!Number.isFinite(parsedPrecio) || parsedPrecio < 0) return res.status(400).json({ error: 'precio debe ser un número >= 0' });
            // Enviar con 2 decimales
            productoPayload.precio = parsedPrecio.toFixed(2);
        }

        // asignar sede_id para producto según perfil / body ANTES de insertar
        let sedeIdToUse = null;
        if (perfil && perfil.rol === 'superadmin') {
            // superadmin puede especificar sede_id en el body (o dejar null)
            if (req.body && req.body.sede_id) sedeIdToUse = Number(req.body.sede_id);
        } else if (perfil && perfil.sede_id) {
            sedeIdToUse = perfil.sede_id;
        }

        if (sedeIdToUse !== null) productoPayload.sede_id = sedeIdToUse;

        const { data: productoData, error: productoError } = await supabaseUser
            .from('producto')
            .insert([productoPayload])
            .select()
            .maybeSingle();

        if (productoError) return res.status(400).json({ error: productoError.message || productoError });
        if (!productoData || !productoData.id) return res.status(500).json({ error: 'No se pudo crear el producto' });

        return res.status(201).json({ mensaje: 'Producto creado', producto: productoData });
    } catch (error) {
        return res.status(500).json({ error: error.message || error });
    }
};

export const obtenerProductosController = async (_req, res) => {
    try {
        const token = getAuthTokenFromReq(_req);
        if (!token) return res.status(401).json({ error: 'Token no proporcionado' });
        const supabaseUser = getSupabaseClientWithToken(token);

        const sedeId = _req && _req.query ? _req.query.sede_id : null;
        let query = supabaseUser.from('producto').select('*').order('id', { ascending: false });
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

export const obtenerProductoPorIdController = async (req, res) => {
    try {
        const token = getAuthTokenFromReq(req);
        if (!token) return res.status(401).json({ error: 'Token no proporcionado' });
        const supabaseUser = getSupabaseClientWithToken(token);

        const { id } = req.params;
        const { data, error } = await supabaseUser.from('producto').select('*').eq('id', id).maybeSingle();
        if (error) return res.status(500).json({ error: error.message || error });
        if (!data) return res.status(404).json({ error: 'Producto no encontrado' });
        return res.json(data);
    } catch (error) {
        return res.status(500).json({ error: error.message || error });
    }
};

export const actualizarProductoController = async (req, res) => {
    try {
        const token = getAuthTokenFromReq(req);
        if (!token) return res.status(401).json({ error: 'Token no proporcionado' });
        const supabaseUser = getSupabaseClientWithToken(token);

        const { id } = req.params;
        const { nombre, descripcion, categoria, precio } = req.body;

        const { data: existing, error: fetchErr } = await supabaseUser.from('producto').select('id').eq('id', id).maybeSingle();
        if (fetchErr) return res.status(500).json({ error: fetchErr.message || fetchErr });
        if (!existing) return res.status(404).json({ error: 'Producto no encontrado' });

        // Para actualización requerimos todos los campos (evitamos updates parciales)
        if (nombre === undefined || descripcion === undefined || categoria === undefined || precio === undefined) {
            return res.status(400).json({ error: 'Nombre, descripción, categoría y precio son obligatorios para actualizar el producto' });
        }

        if (!String(nombre).trim()) return res.status(400).json({ error: 'El nombre del producto no puede estar vacío' });
        if (!nombreRegex.test(String(nombre).trim())) return res.status(400).json({ error: 'El nombre contiene caracteres no permitidos' });
        if (!String(descripcion).trim()) return res.status(400).json({ error: 'La descripción no puede estar vacía' });
        if (!String(categoria).trim()) return res.status(400).json({ error: 'La categoría no puede estar vacía' });
        if (!esPrecioValido(precio)) return res.status(400).json({ error: 'precio inválido (usa formato 0 o 0.00)' });

        const updates = {};
        if (nombre !== undefined) updates.nombre = String(nombre).trim();
        if (descripcion !== undefined) updates.descripcion = descripcion ? String(descripcion).trim() : null;
        if (categoria !== undefined) updates.categoria = categoria ? String(categoria).trim() : null;
        if (precio !== undefined) {
            const parsedPrecio = precio === null || precio === '' ? null : Number(precio);
            if (parsedPrecio !== null && (!Number.isFinite(parsedPrecio) || parsedPrecio < 0)) return res.status(400).json({ error: 'precio debe ser un número >= 0' });
            updates.precio = parsedPrecio !== null ? parsedPrecio.toFixed(2) : null;
        }
        let data = null;
        if (Object.keys(updates).length > 0) {
            const { data: updatedProduct, error } = await supabaseUser.from('producto').update(updates).eq('id', id).select().maybeSingle();
            if (error) return res.status(400).json({ error: error.message || error });
            data = updatedProduct;
        } else {
            const { data: currentProduct, error } = await supabaseUser.from('producto').select('*').eq('id', id).maybeSingle();
            if (error) return res.status(500).json({ error: error.message || error });
            data = currentProduct;
        }

        return res.json({ mensaje: 'Producto actualizado exitosamente', producto: data });
    } catch (error) {
        return res.status(500).json({ error: error.message || error });
    }
};

export const eliminarProductoController = async (req, res) => {
    try {
        const token = getAuthTokenFromReq(req);
        if (!token) return res.status(401).json({ error: 'Token no proporcionado' });
        const supabaseUser = getSupabaseClientWithToken(token);

        const { id } = req.params;
        const { data: existing, error: fetchErr } = await supabaseUser.from('producto').select('id').eq('id', id).maybeSingle();
        if (fetchErr) return res.status(500).json({ error: fetchErr.message || fetchErr });
        if (!existing) return res.status(404).json({ error: 'Producto no encontrado' });

        const { error } = await supabaseUser.from('producto').delete().eq('id', id);
        if (error) return res.status(500).json({ error: error.message || error });

        return res.json({ mensaje: 'Producto eliminado exitosamente' });
    } catch (error) {
        return res.status(500).json({ error: error.message || error });
    }
};
