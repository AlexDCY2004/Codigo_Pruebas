import { defineConfig } from 'cypress';
import { createClient } from '@supabase/supabase-js';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:5173',
    supportFile: 'cypress/support/e2e.js',
    specPattern: 'cypress/e2e/**/*.cy.js',
    viewportWidth: 1280,
    viewportHeight: 800,
    setupNodeEvents(on, config) {
      on('task', {
        async seedDatabase() {
          const supabase = createClient(
            process.env.VITE_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
          );

          const tables = ['movimiento_finanzas', 'cita_tratamiento', 'cita', 'tratamiento', 'doctor', 'paciente', 'perfil', 'sede'];

          for (const table of tables) {
            const { error } = await supabase.from(table).delete().neq('id', table === 'paciente' ? '0' : 0);
            if (error) console.error(`Error limpiando ${table}:`, error);
          }

          const { error: sedeErr } = await supabase.from('sede').insert([
            { id: 1, nombre: 'Sede Test Principal' },
            { id: 2, nombre: 'Sede Test Secundaria' }
          ]);
          if (sedeErr) return { error: sedeErr.message };

          const { error: perfilErr } = await supabase.from('perfil').insert([
            { id: '00000000-0000-0000-0000-000000000001', nombre: 'Admin Test', email: 'admin@test.com', rol: 'superadmin', sede_id: 1 },
            { id: '00000000-0000-0000-0000-000000000002', nombre: 'User Test', email: 'user@test.com', rol: 'administrador', sede_id: 1 }
          ]);
          if (perfilErr) return { error: perfilErr.message };

          const { error: pacErr } = await supabase.from('paciente').insert([
            { id_cedula: '1234567890', nombre: 'Juan', apellido: 'Pérez', telefono: '0999999999', correo: 'juan@test.com', direccion: 'Av. Test 123', sede_id: 1 },
            { id_cedula: '0987654321', nombre: 'María', apellido: 'Gómez', telefono: '0988888888', correo: 'maria@test.com', direccion: 'Calle Test 456', sede_id: 1 }
          ]);
          if (pacErr) return { error: pacErr.message };

          const { error: docErr } = await supabase.from('doctor').insert([
            { id: 1, nombre: 'Dr. Carlos López', telefono: '0977777777', correo: 'carlos@test.com', especialidad: 'Odontología General', estado: 'disponible', sede_id: 1 },
            { id: 2, nombre: 'Dra. Ana Martínez', telefono: '0966666666', correo: 'ana@test.com', especialidad: 'Ortodoncia', estado: 'disponible', sede_id: 1 }
          ]);
          if (docErr) return { error: docErr.message };

          const { error: tratErr } = await supabase.from('tratamiento').insert([
            { id: 1, area: 'Odontología General', nombre: 'Limpieza Dental', precio: 50.00, descripcion: 'Limpieza completa', sede_id: 1 },
            { id: 2, area: 'Odontología General', nombre: 'Consulta General', precio: 30.00, descripcion: 'Consulta de rutina', sede_id: 1 },
            { id: 3, area: 'Ortodoncia', nombre: 'Evaluación Ortodóncica', precio: 80.00, descripcion: 'Evaluación inicial', sede_id: 1 }
          ]);
          if (tratErr) return { error: tratErr.message };

          const { error: citaErr } = await supabase.from('cita').insert([
            { id: 1, id_paciente: '1234567890', id_doctor: 1, fecha: '2026-07-15', hora_inicio: '10:00', hora_fin: '11:00', precio: 80.00, estado: 'agendada', tratamientos: 'Limpieza Dental, Consulta General', metodo_pago: 'efectivo', id_perfil: '00000000-0000-0000-0000-000000000001', sede_id: 1 },
            { id: 2, id_paciente: '0987654321', id_doctor: 2, fecha: '2026-07-16', hora_inicio: '14:00', hora_fin: '15:00', precio: 50.00, estado: 'confirmada', tratamientos: 'Limpieza Dental', metodo_pago: 'transferencia', id_perfil: '00000000-0000-0000-0000-000000000001', sede_id: 1 }
          ]);
          if (citaErr) return { error: citaErr.message };

          const { error: movErr } = await supabase.from('movimiento_finanzas').insert([
            { tipo: 'ingreso', id_perfil: '00000000-0000-0000-0000-000000000001', id_doctor: 1, monto: 80.00, descripcion: 'consulta de: Limpieza Dental, Consulta General', fecha: '2026-07-15', metodo_pago: 'efectivo', sede_id: 1 }
          ]);
          if (movErr) return { error: movErr.message };

          return { success: true };
        }
      });
    }
  }
});
