import { getSupabaseClientWithToken } from '../configuracionesDB/supabaseClient.js';

const precioRegex = /^\d+(?:\.\d{1,2})?$/; // permite decimales con hasta 2 cifras
const stockRegex = /^\d+$/;

const esPrecioValido = (precio) => {
    if (precio === undefined || precio === null || precio === '') return true;
    return precioRegex.test(String(precio).trim());
};

const esStockSoloNumeros = (stock) => {
    if (stock === undefined || stock === null) return true;
    return stockRegex.test(String(stock).trim());
};

export const crearProductoController = async (req, res) => {
    try {
        const token = (req.headers.authorization || '').startsWith('Bearer ') ? req.headers.authorization.replace('Bearer ', '').trim() : null;
        if (!token) return res.status(401).json({ error: 'Token no proporcionado' });
        const supabaseUser = getSupabaseClientWithToken(token);

        const { nombre, descripcion, categoria, stock_producto, stock_minimo, precio } = req.body;

        if (!nombre || !String(nombre).trim()) return res.status(400).json({ error: 'El nombre del producto es obligatorio' });
        if (!esPrecioValido(precio)) return res.status(400).json({ error: 'precio inválido (usa formato 0 o 0.00)' });
        if (!esStockSoloNumeros(stock_producto)) return res.status(400).json({ error: 'stock_producto debe contener solo numeros' });
        if (!esStockSoloNumeros(stock_minimo)) return res.status(400).json({ error: 'stock_minimo debe contener solo numeros' });

        // Validar stocks si fueron proporcionados
        const parsedStock = stock_producto !== undefined && stock_producto !== null ? Number(stock_producto) : null;
        const parsedMin = stock_minimo !== undefined && stock_minimo !== null ? Number(stock_minimo) : null;

        if (parsedStock !== null && (!Number.isFinite(parsedStock) || !Number.isInteger(parsedStock) || parsedStock < 0)) return res.status(400).json({ error: 'stock_producto debe ser un numero entero >= 0' });
        if (parsedMin !== null && (!Number.isFinite(parsedMin) || !Number.isInteger(parsedMin) || parsedMin < 0)) return res.status(400).json({ error: 'stock_minimo debe ser un numero entero >= 0' });

        // 1) Crear producto (incluye precio si se envía)
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
        const inventarioPayload = {
            id_producto: productoData.id,
            id_perfil: perfilId,
            stock_producto: parsedStock !== null ? Math.floor(parsedStock) : 0,
            stock_minimo: parsedMin !== null ? Math.floor(parsedMin) : 0,
            precio: productoData.precio !== null && productoData.precio !== undefined ? Number(productoData.precio).toFixed(2) : '0.00',
            fecha_actualizacion: new Date().toISOString().slice(0, 10) // YYYY-MM-DD
        };

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
        const token = ( (_req && _req.headers && _req.headers.authorization) || '' ).startsWith('Bearer ') ? ((_req.headers.authorization || '').replace('Bearer ', '').trim()) : null;
        if (!token) return res.status(401).json({ error: 'Token no proporcionado' });
        const supabaseUser = getSupabaseClientWithToken(token);

        const { data, error } = await supabaseUser.from('producto').select('*').order('id', { ascending: false });
        if (error) return res.status(500).json({ error: error.message || error });
        return res.json(data);
    } catch (error) {
        return res.status(500).json({ error: error.message || error });
    }
};

export const obtenerProductoPorIdController = async (req, res) => {
    try {
        const token = (req.headers.authorization || '').startsWith('Bearer ') ? req.headers.authorization.replace('Bearer ', '').trim() : null;
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
        const token = (req.headers.authorization || '').startsWith('Bearer ') ? req.headers.authorization.replace('Bearer ', '').trim() : null;
        if (!token) return res.status(401).json({ error: 'Token no proporcionado' });
        const supabaseUser = getSupabaseClientWithToken(token);

        const { id } = req.params;
        const { nombre, descripcion, categoria, precio, stock_producto, stock_minimo } = req.body;

        const { data: existing, error: fetchErr } = await supabaseUser.from('producto').select('id').eq('id', id).maybeSingle();
        if (fetchErr) return res.status(500).json({ error: fetchErr.message || fetchErr });
        if (!existing) return res.status(404).json({ error: 'Producto no encontrado' });

        if (nombre !== undefined && !String(nombre).trim()) return res.status(400).json({ error: 'El nombre del producto no puede estar vacío' });
        if (!esPrecioValido(precio)) return res.status(400).json({ error: 'precio inválido (usa formato 0 o 0.00)' });
        if (!esStockSoloNumeros(stock_producto)) return res.status(400).json({ error: 'stock_producto debe contener solo numeros' });
        if (!esStockSoloNumeros(stock_minimo)) return res.status(400).json({ error: 'stock_minimo debe contener solo numeros' });

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

        const today = new Date().toISOString().slice(0, 10);

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
        const token = (req.headers.authorization || '').startsWith('Bearer ') ? req.headers.authorization.replace('Bearer ', '').trim() : null;
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
