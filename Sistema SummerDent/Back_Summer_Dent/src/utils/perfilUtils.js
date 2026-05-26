import { supabaseAdmin } from '../configuracionesDB/supabaseClient.js';

// Devuelve el perfil (id, rol, sede_id) a partir de un token JWT
export const getPerfilFromToken = async (token) => {
    if (!token) return null;
    try {
        const { data: { user }, error: userErr } = await supabaseAdmin.auth.getUser(token);
        if (userErr || !user || !user.id) {
            // fallback: intentar decodificar el token
            const partes = token.split('.');
            if (partes.length >= 2) {
                try {
                    const base64 = partes[1].replace(/-/g, '+').replace(/_/g, '/');
                    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
                    const payload = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
                    if (payload && payload.sub) {
                        const { data: perfil, error: pErr } = await supabaseAdmin.from('perfil').select('id, rol, sede_id').eq('id', String(payload.sub)).maybeSingle();
                        if (!pErr && perfil) return perfil;
                    }
                } catch (e) {
                    return null;
                }
            }
            return null;
        }

        const { data: perfil, error: perfilErr } = await supabaseAdmin.from('perfil').select('id, rol, sede_id').eq('id', user.id).maybeSingle();
        if (perfilErr) return null;
        return perfil || null;
    } catch (e) {
        return null;
    }
};

export default getPerfilFromToken;
