#!/usr/bin/env node
// Usage: node recalculate_caja.js <sede_id> YYYY-MM [YYYY-MM ...]
// Example: node recalculate_caja.js 1 2026-05 2026-04

import dotenv from 'dotenv';
dotenv.config();

import { supabaseAdmin } from '../src/configuracionesDB/supabaseClient.js';
import { actualizarTotalesCajaParaPeriodo } from '../src/controllers/movimientoFinanzasController.js';

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Uso: node recalculate_caja.js <sede_id> YYYY-MM [YYYY-MM ...]');
  process.exit(1);
}

const sedeId = Number(args[0]);
if (Number.isNaN(sedeId) || sedeId <= 0) {
  console.error('sede_id inválido');
  process.exit(1);
}

const periods = args.slice(1);

(async () => {
  for (const p of periods) {
    if (!/^\d{4}-\d{2}$/.test(p)) {
      console.warn(`Periodo inválido: ${p}, saltando`);
      continue;
    }
    const parts = p.split('-');
    const y = Number(parts[0]);
    const m = Number(parts[1]);
    try {
      console.log(`Recalculando ${p} para sede ${sedeId} ...`);
      await actualizarTotalesCajaParaPeriodo(supabaseAdmin, sedeId, y, m);
      console.log(`OK: ${p}`);
    } catch (err) {
      console.error(`Error recalculando ${p}:`, err);
    }
  }
  process.exit(0);
})();
