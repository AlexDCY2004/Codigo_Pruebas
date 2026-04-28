import { supabase, supabaseAdmin } from '../configuracionesDB/supabaseClient.js';

const getAuthToken = (req) => {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) return null;
    return header.replace('Bearer ', '').trim();
};

export const loginController = async (req, res) => {
    try {
        const { email, password } = req.body;

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

        return res.json({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
            usuario: {
                id: data.user.id,
                email: data.user.email,
                nombre: perfil?.nombre || data.user.user_metadata?.nombre || 'Usuario',
                rol: perfil?.rol ?? null,
            }
        });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

export const registroController = async (req, res) => {
    try {
        const { email, password, nombre } = req.body;

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
                rol: typeof returnedRole !== 'undefined' ? returnedRole : null
            }
        });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

export const obtenerPerfilController = async (req, res) => {
    try {
        const token = getAuthToken(req);

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
            .select('id, nombre, rol, created_at')
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
            created_at: perfil?.created_at
        });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
