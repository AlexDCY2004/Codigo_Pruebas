import { getSupabaseClientWithToken } from '../configuracionesDB/supabaseClient.js';
import { getPerfilFromToken } from '../utils/perfilUtils.js';
import { getAuthTokenFromReq } from '../utils/authUtils.js';

const precioRegex = /^\d+(?:\.\d{1,2})?$/; // permite decimales con hasta 2 cifras
const stockRegex = /^\d+$/;
// Nombre permite letras (incluyendo acentuadas), números, espacios, guión, guión bajo y slash
const nombreRegex = /^[A-Za-z0-9\u00C0-\u017F\s\-_\/]+$/;

const esPrecioValido = (precio) => {
    if (precio === undefined || precio === null || precio === '') return true;
    return precioRegex.test(String(precio).trim());
};

const esStockSoloNumeros = (stock) => {
    if (stock === undefined || stock === null) return true;
    return stockRegex.test(String(stock).trim());
};

const getTodayInputDate = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getMaxInputDate = () => {
    const now = new Date();
    now.setFullYear(now.getFullYear() + 5);
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const parseFechaCaducidad = (fecha) => {
    if (fecha === undefined || fecha === null || String(fecha).trim() === '') return null;
    const raw = String(fecha).trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
    return raw;
};

const esFechaCaducidadValida = (fechaCaducidad) => {
    if (fechaCaducidad === undefined || fechaCaducidad === null || String(fechaCaducidad).trim() === '') return true;
    const raw = String(fechaCaducidad).trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return false;
    return raw >= getTodayInputDate() && raw <= getMaxInputDate();
};

export const crearProductoController = async (req, res) => {
    try {
        const token = getAuthTokenFromReq(req);
        if (!token) return res.status(401).json({ error: 'Token no proporcionado' });
        const supabaseUser = getSupabaseClientWithToken(token);

        const { nombre, descripcion, categoria, stock_producto, stock_minimo, precio, fecha_caducidad } = req.body;

        // Campos base obligatorios; fecha_caducidad es opcional ramaAlex
        if (!nombre || !String(nombre).trim()) return res.status(400).json({ error: 'El nombre del producto es obligatorio' });
        if (!nombreRegex.test(String(nombre).trim())) return res.status(400).json({ error: "El nombre contiene caracteres no permitidos" });
        if (!descripcion || !String(descripcion).trim()) return res.status(400).json({ error: 'La descripción es obligatoria' });
        if (!categoria || !String(categoria).trim()) return res.status(400).json({ error: 'La categoría es obligatoria' });
        if (precio === undefined || precio === null || String(precio).trim() === '') return res.status(400).json({ error: 'El precio es obligatorio' });
        if (!esPrecioValido(precio)) return res.status(400).json({ error: 'precio inválido (usa formato 0 o 0.00)' });
        if (stock_producto === undefined || stock_producto === null || String(stock_producto).trim() === '') return res.status(400).json({ error: 'stock_producto es obligatorio' });
        if (stock_minimo === undefined || stock_minimo === null || String(stock_minimo).trim() === '') return res.status(400).json({ error: 'stock_minimo es obligatorio' });
        if (!esStockSoloNumeros(stock_producto)) return res.status(400).json({ error: 'stock_producto debe contener solo numeros' });
        if (!esStockSoloNumeros(stock_minimo)) return res.status(400).json({ error: 'stock_minimo debe contener solo numeros' });
        if (!esFechaCaducidadValida(fecha_caducidad)) return res.status(400).json({ error: 'fecha_caducidad debe ser una fecha válida, no anterior a hoy y no mayor a 5 años' });

        // Validar stocks si fueron proporcionados
        const parsedStock = stock_producto !== undefined && stock_producto !== null ? Number(stock_producto) : null;
        const parsedMin = stock_minimo !== undefined && stock_minimo !== null ? Number(stock_minimo) : null;

        if (parsedStock !== null && (!Number.isFinite(parsedStock) || !Number.isInteger(parsedStock) || parsedStock < 0)) return res.status(400).json({ error: 'stock_producto debe ser un numero entero >= 0' });
        if (parsedMin !== null && (!Number.isFinite(parsedMin) || !Number.isInteger(parsedMin) || parsedMin < 0)) return res.status(400).json({ error: 'stock_minimo debe ser un numero entero >= 0' });

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

        // Obtener id de perfil (usuario) desde el cliente supabase con token
        let perfilId = null;
        try {
            const { data: userData } = await supabaseUser.auth.getUser();
            if (userData && userData.user && userData.user.id) perfilId = userData.user.id;
            else if (userData && userData.id) perfilId = userData.id; // fallback
        } catch (e) {
            // no crítico: si no podemos obtener usuario, dejamos perfilId = null
            perfilId = null;
        }

        // 2) Crear inventario asociado (siempre se crea aunque stocks no se envíen: usa defaults)
        const now = new Date();
        const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

        const parsedFechaCaducidad = parseFechaCaducidad(fecha_caducidad);

        // Reutilizar `sedeIdToUse` ya calculado arriba para asignar al inventario si aplica

        const inventarioPayload = {
            id_producto: productoData.id,
            id_perfil: perfilId,
            stock_producto: parsedStock !== null ? Math.floor(parsedStock) : 0,
            stock_minimo: parsedMin !== null ? Math.floor(parsedMin) : 0,
            precio: productoData.precio !== null && productoData.precio !== undefined ? Number(productoData.precio).toFixed(2) : '0.00',
            fecha_actualizacion: todayLocal
        };

        // incluir fecha de caducidad si fue provista y parseada correctamente
        if (parsedFechaCaducidad !== null) {
            inventarioPayload.fecha_caducidad = parsedFechaCaducidad;
        }

        if (sedeIdToUse !== null) inventarioPayload.sede_id = sedeIdToUse;

        const { data: invData, error: invError } = await supabaseUser.from('inventario').insert([inventarioPayload]).select().maybeSingle();

        if (invError) {
            // Rollback manual: eliminar el producto creado para evitar inconsistencia
            await supabaseUser.from('producto').delete().eq('id', productoData.id);
            return res.status(400).json({ error: invError.message || invError });
        }

        return res.status(201).json({ mensaje: 'Producto e inventario creados', producto: productoData, inventario: invData });
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
        const { nombre, descripcion, categoria, precio, stock_producto, stock_minimo, fecha_caducidad } = req.body;

        const { data: existing, error: fetchErr } = await supabaseUser.from('producto').select('id').eq('id', id).maybeSingle();
        if (fetchErr) return res.status(500).json({ error: fetchErr.message || fetchErr });
        if (!existing) return res.status(404).json({ error: 'Producto no encontrado' });

        // Para actualización requerimos todos los campos (evitamos updates parciales)
        if (nombre === undefined || descripcion === undefined || categoria === undefined || precio === undefined || stock_producto === undefined || stock_minimo === undefined) {
            return res.status(400).json({ error: 'Nombre, descripción, categoría, precio, stock_producto y stock_minimo son obligatorios para actualizar el producto' });
        }

        if (!String(nombre).trim()) return res.status(400).json({ error: 'El nombre del producto no puede estar vacío' });
        if (!nombreRegex.test(String(nombre).trim())) return res.status(400).json({ error: 'El nombre contiene caracteres no permitidos' });
        if (!String(descripcion).trim()) return res.status(400).json({ error: 'La descripción no puede estar vacía' });
        if (!String(categoria).trim()) return res.status(400).json({ error: 'La categoría no puede estar vacía' });
        if (!esPrecioValido(precio)) return res.status(400).json({ error: 'precio inválido (usa formato 0 o 0.00)' });
        if (!esStockSoloNumeros(stock_producto)) return res.status(400).json({ error: 'stock_producto debe contener solo numeros' });
        if (!esStockSoloNumeros(stock_minimo)) return res.status(400).json({ error: 'stock_minimo debe contener solo numeros' });
        if (fecha_caducidad !== undefined && fecha_caducidad !== null && String(fecha_caducidad).trim() !== '' && !esFechaCaducidadValida(fecha_caducidad)) {
            return res.status(400).json({ error: 'fecha_caducidad debe ser una fecha válida, no anterior a hoy y no mayor a 5 años' });
        }

        const parsedStock = stock_producto !== undefined && stock_producto !== null ? Number(stock_producto) : null;
        const parsedMin = stock_minimo !== undefined && stock_minimo !== null ? Number(stock_minimo) : null;

        if (parsedStock !== null && (!Number.isFinite(parsedStock) || !Number.isInteger(parsedStock) || parsedStock < 0)) return res.status(400).json({ error: 'stock_producto debe ser un numero entero >= 0' });
        if (parsedMin !== null && (!Number.isFinite(parsedMin) || !Number.isInteger(parsedMin) || parsedMin < 0)) return res.status(400).json({ error: 'stock_minimo debe ser un numero entero >= 0' });

        const updates = {};
        if (nombre !== undefined) updates.nombre = String(nombre).trim();
        if (descripcion !== undefined) updates.descripcion = descripcion ? String(descripcion).trim() : null;
        if (categoria !== undefined) updates.categoria = categoria ? String(categoria).trim() : null;
        if (precio !== undefined) {
            const parsedPrecio = precio === null || precio === '' ? null : Number(precio);
            if (parsedPrecio !== null && (!Number.isFinite(parsedPrecio) || parsedPrecio < 0)) return res.status(400).json({ error: 'precio debe ser un número >= 0' });
            updates.precio = parsedPrecio !== null ? parsedPrecio.toFixed(2) : null;
        }
        const now = new Date();
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

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

        const inventarioUpdates = {};
        if (parsedStock !== null) inventarioUpdates.stock_producto = Math.floor(parsedStock);
        if (parsedMin !== null) inventarioUpdates.stock_minimo = Math.floor(parsedMin);
        if (updates.precio !== undefined && updates.precio !== null) inventarioUpdates.precio = updates.precio;
        const parsedFechaCaducidad = parseFechaCaducidad(fecha_caducidad);
        if (parsedFechaCaducidad !== null) inventarioUpdates.fecha_caducidad = parsedFechaCaducidad;

        if (Object.keys(inventarioUpdates).length > 0) {
            inventarioUpdates.fecha_actualizacion = today;
            const { error: invErr } = await supabaseUser
                .from('inventario')
                .update(inventarioUpdates)
                .eq('id_producto', id);

            if (invErr) return res.status(500).json({ error: invErr.message || invErr });
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
