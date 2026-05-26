import { getSupabaseClientWithToken } from '../configuracionesDB/supabaseClient.js';
import { getPerfilFromToken } from '../utils/perfilUtils.js';
import { getAuthTokenFromReq } from '../utils/authUtils.js';

export const obtenerInventariosController = async (_req, res) => {
    try {
        const token = getAuthTokenFromReq(_req);
        if (!token) return res.status(401).json({ error: 'Token no proporcionado' });
        const supabaseUser = getSupabaseClientWithToken(token);

        // incluir datos del producto (precio, nombre, etc.)
        const sedeId = _req && _req.query ? _req.query.sede_id : null;
        let query = supabaseUser.from('inventario').select('*, producto(*)').order('id', { ascending: false });
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

export const obtenerInventarioPorProductoController = async (req, res) => {
    try {
        const token = getAuthTokenFromReq(req);
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
        const token = getAuthTokenFromReq(req);
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
        // determinar sede según perfil (administrador) o body (superadmin)
        const perfil = await getPerfilFromToken(token);
        let sedeToUse = null;
        if (perfil && perfil.rol === 'superadmin') {
            if (req.body && req.body.sede_id) sedeToUse = Number(req.body.sede_id);
        } else if (perfil && perfil.sede_id) {
            sedeToUse = perfil.sede_id;
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

        const now = new Date();
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

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
            // aceptar fecha de caducidad opcional desde body
            if (req.body && req.body.fecha_caducidad) {
                // tomar los primeros 10 caracteres (YYYY-MM-DD) si vienen completos
                payload.fecha_caducidad = String(req.body.fecha_caducidad).trim().slice(0, 10);
            }
            if (sedeToUse !== null) payload.sede_id = sedeToUse;

            const { data, error } = await supabaseUser.from('inventario').insert([payload]).select('*, producto(*)').maybeSingle();
            if (error) return res.status(400).json({ error: error.message || error });
            return res.status(201).json({ mensaje: 'Inventario creado y stock aumentado', inventario: data });
        }

        // actualizar stock
        const newStock = (Number(existing.stock_producto) || 0) + Math.floor(qty);
        const updatePayload = { stock_producto: newStock, fecha_actualizacion: today, id_perfil: perfilId, precio: precioProducto };
        if (sedeToUse !== null) updatePayload.sede_id = sedeToUse;
        const { data: updated, error: updateErr } = await supabaseUser.from('inventario').update(updatePayload).eq('id', existing.id).select('*, producto(*)').maybeSingle();
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

        const { id_producto, tipo_movimiento, cantidad, monto, metodo_pago, detalle_pago } = req.body;

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

        const now = new Date();
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

        // Obtener id de perfil (usuario) desde el cliente supabase con token
        let perfilId = null;
        try {
            const { data: userData } = await supabaseUser.auth.getUser();
            if (userData && userData.user && userData.user.id) perfilId = userData.user.id;
            else if (userData && userData.id) perfilId = userData.id;
        } catch (e) {
            perfilId = null;
        }

        // determinar sede según perfil (administrador) o body (superadmin)
        const perfil = await getPerfilFromToken(token);
        let sedeToUse = null;
        if (perfil && perfil.rol === 'superadmin') {
            if (req.body && req.body.sede_id) sedeToUse = Number(req.body.sede_id);
        } else if (perfil && perfil.sede_id) {
            sedeToUse = perfil.sede_id;
        }

        const allowedPaymentMethods = ['efectivo', 'transferencia', 'tarjeta'];
        const metodoPagoNormalizado = (metodo_pago !== undefined && metodo_pago !== null && String(metodo_pago).trim() !== '')
            ? String(metodo_pago).trim()
            : 'efectivo';
        if (!allowedPaymentMethods.includes(metodoPagoNormalizado)) {
            return res.status(400).json({ error: `metodo_pago inválido. Debe ser uno de: ${allowedPaymentMethods.join(', ')}` });
        }

        const gastoCompra = Number(monto);

        if (tipo_movimiento === 'entrada') {
            const precioProducto = prodData.precio !== null && prodData.precio !== undefined ? Number(prodData.precio).toFixed(2) : '0.00';
            if (!Number.isFinite(gastoCompra) || gastoCompra <= 0) return res.status(400).json({ error: 'monto debe ser un número mayor que 0 para registrar una entrada de stock' });
            // aumentar stock (crear inventario si no existe)
            if (!existing) {
                const perfil2 = await getPerfilFromToken(token);
                let sedeToUse2 = null;
                if (perfil2 && perfil2.rol === 'superadmin') {
                    if (req.body && req.body.sede_id) sedeToUse2 = Number(req.body.sede_id);
                } else if (perfil2 && perfil2.sede_id) {
                    sedeToUse2 = perfil2.sede_id;
                }

                const payload = {
                    id_producto: id_producto,
                    id_perfil: perfilId,
                    stock_producto: Math.floor(qty),
                    stock_minimo: 0,
                    precio: precioProducto,
                    fecha_actualizacion: today
                };
                if (req.body && req.body.fecha_caducidad) payload.fecha_caducidad = String(req.body.fecha_caducidad).trim().slice(0,10);
                if (sedeToUse2 !== null) payload.sede_id = sedeToUse2;
                const { data, error } = await supabaseUser.from('inventario').insert([payload]).select('*, producto(*)').maybeSingle();
                if (error) return res.status(400).json({ error: error.message || error });

                const movimientoPayload = {
                    id_perfil: perfilId,
                    id_doctor: null,
                    tipo: 'egreso',
                    monto: Number(gastoCompra.toFixed(2)),
                    descripcion: `Gasto por compra de "${prodData.nombre}"`,
                    metodo_pago: metodoPagoNormalizado,
                    fecha: today
                };
                if (sedeToUse2 !== null) movimientoPayload.sede_id = sedeToUse2;

                const { data: movData, error: movErr } = await supabaseUser.from('movimiento_finanzas').insert([movimientoPayload]).select().maybeSingle();
                if (movErr) {
                    await supabaseUser.from('inventario').delete().eq('id', data.id);
                    return res.status(500).json({ error: movErr.message || movErr });
                }

                return res.status(201).json({ mensaje: 'Entrada registrada, stock creado y egreso creado', inventario: data, movimiento: movData });
            }

            const newStock = (Number(existing.stock_producto) || 0) + Math.floor(qty);
            const updatePayload2 = { stock_producto: newStock, fecha_actualizacion: today, id_perfil: perfilId, precio: precioProducto };
            if (sedeToUse !== null) updatePayload2.sede_id = sedeToUse;
            const { data: updated, error: updateErr } = await supabaseUser.from('inventario').update(updatePayload2).eq('id', existing.id).select('*, producto(*)').maybeSingle();
            if (updateErr) return res.status(400).json({ error: updateErr.message || updateErr });

            const movimientoPayload = {
                id_perfil: perfilId,
                id_doctor: null,
                tipo: 'egreso',
                monto: Number(gastoCompra.toFixed(2)),
                descripcion: `Gasto por compra de "${prodData.nombre}"`,
                metodo_pago: metodoPagoNormalizado,
                fecha: today
            };
            if (sedeToUse !== null) movimientoPayload.sede_id = sedeToUse;

            const { data: movData, error: movErr } = await supabaseUser.from('movimiento_finanzas').insert([movimientoPayload]).select().maybeSingle();
            if (movErr) {
                await supabaseUser.from('inventario').update({ stock_producto: existing.stock_producto, fecha_actualizacion: today }).eq('id', existing.id);
                return res.status(500).json({ error: movErr.message || movErr });
            }

            return res.json({ mensaje: 'Entrada registrada, stock actualizado y egreso creado', inventario: updated, movimiento: movData });
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
        const updatePayload3 = { stock_producto: newStock, fecha_actualizacion: today, id_perfil: perfilId, precio: precioUnit.toFixed(2) };
        if (sedeToUse !== null) updatePayload3.sede_id = sedeToUse;
        const { data: updatedInv, error: invErr } = await supabaseUser.from('inventario').update(updatePayload3).eq('id', existing.id).select('*, producto(*)').maybeSingle();
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
        if (sedeToUse !== null) movimientoPayload.sede_id = sedeToUse;
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
