import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

function getSedeFilter() {
  const sedeActiva = useAuthStore.getState().sedeActiva;
  if (sedeActiva !== null && sedeActiva !== undefined) {
    return { sede_id: sedeActiva };
  }
  return {};
}

export { supabase, getSedeFilter };
