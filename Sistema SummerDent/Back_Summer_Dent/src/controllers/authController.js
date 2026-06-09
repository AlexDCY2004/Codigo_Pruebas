import { supabase, supabaseAdmin } from '../configuracionesDB/supabaseClient.js';
import { clearAuthCookies, getAuthTokenFromReq, getRefreshTokenFromReq, setAuthCookies } from '../utils/authUtils.js';

export const loginController = async (req, res) => {
    try {
        const { email, password } = req.body;
        let returnedRole = null;

        if (!email || !password) {
            return res.status(400).json({
                error: 'Email y contraseña son requeridos'
            });
        }

        const { data, error } = await supabase.auth.signInWithPassword({
            email: String(email).trim().toLowerCase(),
            password: String(password)
        });

        if (error || !data?.user || !data?.session) {
            return res.status(401).json({
                error: 'Credenciales inválidas'
            });
        }

        const { data: perfil, error: perfilError } = await supabaseAdmin
            .from('perfil')
            .select('id, nombre, rol, created_at')
            .eq('id', data.user.id)
            .maybeSingle();

        if (perfilError) {
            console.warn('Error leyendo perfil en login:', perfilError.message || perfilError);
        }

        setAuthCookies(res, {
            accessToken: data.session.access_token,
            refreshToken: data.session.refresh_token,
            accessMaxAgeMs: Number(data.session.expires_in || 3600) * 1000
        });

        returnedRole = perfil?.rol ?? null;

        // En entornos de desarrollo, devolver también los tokens en el cuerpo
        // como fallback para facilitar el desarrollo local (evita bloquear
        // el flujo si el entorno de cookies cross-site no está configurado).
        const resp = {
            usuario: {
                id: data.user.id,
                email: data.user.email,
                nombre: perfil?.nombre || data.user.user_metadata?.nombre || 'Usuario',
                rol: returnedRole,
                sede_id: perfil?.sede_id ?? null,
            }
        };

        if (process.env.NODE_ENV !== 'production') {
            resp.accessToken = data.session.access_token;
            resp.refreshToken = data.session.refresh_token;
        }

        return res.json(resp);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

export const registroController = async (req, res) => {
    try {
        const { email, password, nombre } = req.body;
        let returnedRole = null;

        if (!email || !password || !nombre) {
            return res.status(400).json({
                error: 'Nombre, email y contraseña son requeridos'
            });
        }

        if (String(password).length < 6) {
            return res.status(400).json({
                error: 'La contraseña debe tener al menos 6 caracteres'
            });
        }

        const { data, error } = await supabase.auth.signUp({
            email: String(email).trim().toLowerCase(),
            password: String(password),
            options: {
                data: {
                    nombre: String(nombre).trim()
                }
            }
        });

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        // Crear fila en `perfil` sin especificar `rol` para que la DB aplique el default (administrador si así lo configuraste)
        try {
            const userId = data.user?.id;
            if (userId) {
                await supabaseAdmin.from('perfil').insert([
                    {
                        id: userId,
                        nombre: String(nombre).trim()
                    }
                ]);
                // Leer perfil insertado para obtener el rol aplicado por la BD
                try {
                    const { data: insertedPerfil, error: insertedErr } = await supabaseAdmin
                        .from('perfil')
                        .select('rol')
                        .eq('id', userId)
                        .maybeSingle();

                    if (insertedErr) console.warn('Error leyendo perfil tras insert:', insertedErr.message || insertedErr);
                    else if (insertedPerfil) returnedRole = insertedPerfil.rol;
                } catch (e) {
                    console.warn('Error interno leyendo perfil tras insert:', e.message || e);
                }
            }
        } catch (perfilErr) {
            console.warn('No se pudo crear fila en perfil:', perfilErr?.message || perfilErr);
        }
        // Devolver rol leído si se pudo obtener
        return res.status(201).json({
            mensaje: 'Registro exitoso. Revisa tu correo para confirmar la cuenta si aplica.',
            usuario: {
                id: data.user?.id,
                email: data.user?.email,
                nombre: String(nombre).trim(),
                rol: returnedRole
            }
        });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

export const obtenerPerfilController = async (req, res) => {
    try {
        const token = getAuthTokenFromReq(req);

        if (!token) {
            return res.status(401).json({ error: 'Token no proporcionado' });
        }

        const {
            data: { user },
            error: userError
        } = await supabase.auth.getUser(token);

        if (userError || !user) {
            return res.status(401).json({ error: 'Token inválido o expirado' });
        }

        const { data: perfil, error: perfilError } = await supabaseAdmin
            .from('perfil')
            .select('id, nombre, rol, sede_id, created_at')
            .eq('id', user.id)
            .maybeSingle();

        if (perfilError) {
            return res.status(400).json({ error: perfilError.message });
        }

        return res.json({
            id: user.id,
            email: user.email,
            nombre: perfil?.nombre || user.user_metadata?.nombre || 'Usuario',
            rol: perfil?.rol ?? null,
            sede_id: perfil?.sede_id ?? null,
            created_at: perfil?.created_at
        });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

export const refreshController = async (req, res) => {
    try {
        const refreshToken = getRefreshTokenFromReq(req);

        if (!refreshToken) {
            return res.status(401).json({ error: 'Refresh token no proporcionado' });
        }

        const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
        if (error || !data?.session || !data?.user) {
            clearAuthCookies(res);
            return res.status(401).json({ error: 'No fue posible renovar la sesión' });
        }

        const { data: perfil, error: perfilError } = await supabaseAdmin
            .from('perfil')
            .select('id, nombre, rol, sede_id, created_at')
            .eq('id', data.user.id)
            .maybeSingle();

        if (perfilError) {
            console.warn('Error leyendo perfil en refresh:', perfilError.message || perfilError);
        }

        setAuthCookies(res, {
            accessToken: data.session.access_token,
            refreshToken: data.session.refresh_token,
            accessMaxAgeMs: Number(data.session.expires_in || 3600) * 1000
        });

        const resp = {
            usuario: {
                id: data.user.id,
                email: data.user.email,
                nombre: perfil?.nombre || data.user.user_metadata?.nombre || 'Usuario',
                rol: perfil?.rol ?? null,
                sede_id: perfil?.sede_id ?? null,
                created_at: perfil?.created_at
            }
        };

        if (process.env.NODE_ENV !== 'production') {
            resp.accessToken = data.session.access_token;
            resp.refreshToken = data.session.refresh_token;
        }

        return res.json(resp);
    } catch (error) {
        clearAuthCookies(res);
        return res.status(500).json({ error: error.message });
    }
};

export const logoutController = async (_req, res) => {
    try {
        clearAuthCookies(res);
        return res.json({ mensaje: 'Sesión cerrada' });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
