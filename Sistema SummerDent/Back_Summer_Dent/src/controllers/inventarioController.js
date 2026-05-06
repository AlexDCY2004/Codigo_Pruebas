import { getSupabaseClientWithToken } from '../configuracionesDB/supabaseClient.js';

export const obtenerInventariosController = async (_req, res) => {
    try {
        const token = ( (_req && _req.headers && _req.headers.authorization) || '' ).startsWith('Bearer ') ? ((_req.headers.authorization || '').replace('Bearer ', '').trim()) : null;
        if (!token) return res.status(401).json({ error: 'Token no proporcionado' });
        const supabaseUser = getSupabaseClientWithToken(token);

        // incluir datos del producto (precio, nombre, etc.)
        const { data, error } = await supabaseUser.from('inventario').select('*, producto(*)').order('id', { ascending: false });
        if (error) return res.status(500).json({ error: error.message || error });
        return res.json(data);
    } catch (error) {
        return res.status(500).json({ error: error.message || error });
    }
};

export const obtenerInventarioPorProductoController = async (req, res) => {
    try {
        const token = (req.headers.authorization || '').startsWith('Bearer ') ? req.headers.authorization.replace('Bearer ', '').trim() : null;
        if (!token) return res.status(401).json({ error: 'Token no proporcionado' });
        const supabaseUser = getSupabaseClientWithToken(token);

        const { id_producto } = req.params;
        if (!id_producto) return res.status(400).json({ error: 'id_producto requerido' });

        const { data, error } = await supabaseUser.from('inventario').select('*, producto(*)').eq('id_producto', id_producto).maybeSingle();
        if (error) return res.status(500).json({ error: error.message || error });
        if (!data) return res.status(404).json({ error: 'Inventario no encontrado para ese producto' });
        return res.json(data);
    } catch (error) {
        return res.status(500).json({ error: error.message || error });
    }
};

export const aumentarStockController = async (req, res) => {
    try {
        const token = (req.headers.authorization || '').startsWith('Bearer ') ? req.headers.authorization.replace('Bearer ', '').trim() : null;
        if (!token) return res.status(401).json({ error: 'Token no proporcionado' });
        const supabaseUser = getSupabaseClientWithToken(token);

        const { id_producto, cantidad } = req.body;
        if (!id_producto) return res.status(400).json({ error: 'id_producto es requerido' });
        const qty = Number(cantidad);
        if (!Number.isFinite(qty) || qty <= 0) return res.status(400).json({ error: 'cantidad debe ser un número entero mayor que 0' });

        // obtener id del perfil del usuario autenticado (si está disponible)
        let perfilId = null;
        try {
            const { data: userData } = await supabaseUser.auth.getUser();
            if (userData && userData.user && userData.user.id) perfilId = userData.user.id;
            else if (userData && userData.id) perfilId = userData.id;
        } catch (e) {
            perfilId = null;
        }

        // validar que el producto exista
        if (!Number.isFinite(Number(id_producto))) return res.status(400).json({ error: 'id_producto inválido' });
        const { data: prodData, error: prodErr } = await supabaseUser.from('producto').select('id,precio').eq('id', id_producto).maybeSingle();
        if (prodErr) return res.status(500).json({ error: prodErr.message || prodErr });
        if (!prodData) return res.status(404).json({ error: 'Producto no encontrado' });

        const precioProducto = prodData.precio !== null && prodData.precio !== undefined ? Number(prodData.precio).toFixed(2) : '0.00';

        // buscar inventario existente
        const { data: existing, error: fetchErr } = await supabaseUser.from('inventario').select('*').eq('id_producto', id_producto).maybeSingle();
        if (fetchErr) return res.status(500).json({ error: fetchErr.message || fetchErr });

        const today = new Date().toISOString().slice(0, 10);

        if (!existing) {
            // crear nueva fila si no existe
            const payload = {
                id_producto: id_producto,
                id_perfil: perfilId,
                stock_producto: Math.floor(qty),
                stock_minimo: 0,
                precio: precioProducto,
                fecha_actualizacion: today
            };

            const { data, error } = await supabaseUser.from('inventario').insert([payload]).select('*, producto(*)').maybeSingle();
            if (error) return res.status(400).json({ error: error.message || error });
            return res.status(201).json({ mensaje: 'Inventario creado y stock aumentado', inventario: data });
        }

        // actualizar stock
        const newStock = (Number(existing.stock_producto) || 0) + Math.floor(qty);
        const { data: updated, error: updateErr } = await supabaseUser.from('inventario').update({ stock_producto: newStock, fecha_actualizacion: today, id_perfil: perfilId, precio: precioProducto }).eq('id', existing.id).select('*, producto(*)').maybeSingle();
        if (updateErr) return res.status(400).json({ error: updateErr.message || updateErr });

        return res.json({ mensaje: 'Stock aumentado', inventario: updated });
    } catch (error) {
        return res.status(500).json({ error: error.message || error });
    }
};

export const registraMovimientoController = async (req, res) => {
    try {
        const token = (req.headers.authorization || '').startsWith('Bearer ') ? req.headers.authorization.replace('Bearer ', '').trim() : null;
        if (!token) return res.status(401).json({ error: 'Token no proporcionado' });
        const supabaseUser = getSupabaseClientWithToken(token);

        const { id_producto, tipo_movimiento, cantidad, metodo_pago, detalle_pago } = req.body;

        if (!id_producto) return res.status(400).json({ error: 'id_producto es requerido' });
        const qty = Number(cantidad);
        if (!Number.isFinite(qty) || qty <= 0 || !Number.isInteger(qty)) return res.status(400).json({ error: 'cantidad debe ser un entero mayor que 0' });

        if (!['entrada', 'salida'].includes(String(tipo_movimiento))) return res.status(400).json({ error: "tipo_movimiento debe ser 'entrada' o 'salida'" });

        // validar producto
        const { data: prodData, error: prodErr } = await supabaseUser.from('producto').select('id,nombre,precio').eq('id', id_producto).maybeSingle();
        if (prodErr) return res.status(500).json({ error: prodErr.message || prodErr });
        if (!prodData) return res.status(404).json({ error: 'Producto no encontrado' });

        // obtener inventario actual
        const { data: existing, error: fetchErr } = await supabaseUser.from('inventario').select('*').eq('id_producto', id_producto).maybeSingle();
        if (fetchErr) return res.status(500).json({ error: fetchErr.message || fetchErr });

        const today = new Date().toISOString().slice(0, 10);

        // Obtener id de perfil (usuario) desde el cliente supabase con token
        let perfilId = null;
        try {
            const { data: userData } = await supabaseUser.auth.getUser();
            if (userData && userData.user && userData.user.id) perfilId = userData.user.id;
            else if (userData && userData.id) perfilId = userData.id;
        } catch (e) {
            perfilId = null;
        }

        if (tipo_movimiento === 'entrada') {
            const precioProducto = prodData.precio !== null && prodData.precio !== undefined ? Number(prodData.precio).toFixed(2) : '0.00';
            // aumentar stock (crear inventario si no existe)
            if (!existing) {
                const payload = {
                    id_producto: id_producto,
                    id_perfil: perfilId,
                    stock_producto: Math.floor(qty),
                    stock_minimo: 0,
                    precio: precioProducto,
                    fecha_actualizacion: today
                };
                const { data, error } = await supabaseUser.from('inventario').insert([payload]).select('*, producto(*)').maybeSingle();
                if (error) return res.status(400).json({ error: error.message || error });
                return res.status(201).json({ mensaje: 'Entrada registrada y stock creado', inventario: data });
            }

            const newStock = (Number(existing.stock_producto) || 0) + Math.floor(qty);
            const { data: updated, error: updateErr } = await supabaseUser.from('inventario').update({ stock_producto: newStock, fecha_actualizacion: today, id_perfil: perfilId, precio: precioProducto }).eq('id', existing.id).select('*, producto(*)').maybeSingle();
            if (updateErr) return res.status(400).json({ error: updateErr.message || updateErr });
            return res.json({ mensaje: 'Entrada registrada y stock actualizado', inventario: updated });
        }

        // tipo_movimiento === 'salida'
        // verificar stock suficiente
        if (!existing) return res.status(400).json({ error: 'No hay inventario para ese producto' });
        const currentStock = Number(existing.stock_producto) || 0;
        if (qty > currentStock) return res.status(400).json({ error: 'Stock insuficiente' });

        const newStock = currentStock - Math.floor(qty);

        // calcular total venta: cantidad * precio unitario
        const precioUnit = prodData.precio !== null && prodData.precio !== undefined ? Number(prodData.precio) : 0;
        const totalVenta = Number((precioUnit * qty).toFixed(2));

        // actualizar inventario
        const { data: updatedInv, error: invErr } = await supabaseUser.from('inventario').update({ stock_producto: newStock, fecha_actualizacion: today, id_perfil: perfilId, precio: precioUnit.toFixed(2) }).eq('id', existing.id).select('*, producto(*)').maybeSingle();
        if (invErr) return res.status(500).json({ error: invErr.message || invErr });

        // crear movimiento financiero: tipo 'ingreso', id_doctor NULL (no especificado), descripcion con nombre del producto
        // validar metodo_pago si fue provisto
        if (metodo_pago !== undefined && metodo_pago !== null && String(metodo_pago).trim() !== '') {
            const allowed = ['efectivo', 'transferencia', 'tarjeta'];
            if (!allowed.includes(String(metodo_pago))) return res.status(400).json({ error: `metodo_pago inválido. Debe ser uno de: ${allowed.join(', ')}` });
        }

        // Construir descripción incluyendo el detalle de pago (no existe columna detalle_pago)
        let descripcionBase = `Venta de ${prodData.nombre} (cantidad: ${qty})`;
        if (detalle_pago !== undefined && detalle_pago !== null && String(detalle_pago).trim() !== '') {
            descripcionBase = `${descripcionBase} - ${String(detalle_pago).trim()}`;
        }

        const movimientoPayload = {
            id_perfil: perfilId,
            id_doctor: null,
            tipo: 'ingreso',
            monto: totalVenta,
            descripcion: descripcionBase,
            fecha: today
        };
        if (metodo_pago !== undefined && metodo_pago !== null && String(metodo_pago).trim() !== '') movimientoPayload.metodo_pago = String(metodo_pago);

        // Si es venta y no hay metodo_pago, usar 'efectivo' por defecto para evitar NOT NULL
        if (String(tipo_movimiento) === 'salida' && (!movimientoPayload.metodo_pago || String(movimientoPayload.metodo_pago).trim() === '')) {
            movimientoPayload.metodo_pago = 'efectivo';
        }

        const { data: movData, error: movErr } = await supabaseUser.from('movimiento_finanzas').insert([movimientoPayload]).select().maybeSingle();
        if (movErr) {
            // intentar revertir inventario al estado anterior
            await supabaseUser.from('inventario').update({ stock_producto: currentStock, fecha_actualizacion: today }).eq('id', existing.id);
            return res.status(500).json({ error: movErr.message || movErr });
        }

        return res.json({ mensaje: 'Salida registrada, stock actualizado y movimiento financiero creado', inventario: updatedInv, movimiento: movData });
    } catch (error) {
        return res.status(500).json({ error: error.message || error });
    }
};

export default {
    obtenerInventariosController,
    obtenerInventarioPorProductoController,
    aumentarStockController
};
