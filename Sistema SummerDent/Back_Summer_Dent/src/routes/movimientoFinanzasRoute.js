import { Router } from 'express';
import {
  crearMovimientoController,
  obtenerMovimientosController,
  obtenerMovimientoPorIdController,
  actualizarMovimientoController,
  eliminarMovimientoController
} from '../controllers/movimientoFinanzasController.js';

const router = Router();

router.get('/', obtenerMovimientosController);
router.get('/:id', obtenerMovimientoPorIdController);
router.post('/', crearMovimientoController);
router.put('/:id', actualizarMovimientoController);
router.delete('/:id', eliminarMovimientoController);

export default router;
