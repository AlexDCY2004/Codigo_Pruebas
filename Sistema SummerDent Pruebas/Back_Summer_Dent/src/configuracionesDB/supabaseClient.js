import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.SUPABASE_DB_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || (!SUPABASE_ANON_KEY && !SUPABASE_SERVICE_ROLE_KEY)) {
    console.warn('Warning: SUPABASE_URL or SUPABASE keys not set in environment');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false }
});

// Admin client using service role key when available
export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY, {
    auth: { persistSession: false }
});

export default supabase;

// Devuelve un cliente Supabase configurado con el token JWT del usuario
export const getSupabaseClientWithToken = (token) => {
    const opts = {
        auth: { persistSession: false }
    };

    // If token provided, set Authorization header so RLS uses the user's identity
    if (token) {
        opts.global = { headers: { Authorization: `Bearer ${token}` } };
    }

    return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, opts);
};
