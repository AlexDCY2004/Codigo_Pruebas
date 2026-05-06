import { Router } from 'express';
import {
  crearTratamientoController,
  obtenerTratamientosController,
  obtenerTratamientoPorIdController,
  actualizarTratamientoController,
  eliminarTratamientoController
} from '../controllers/tratamientoController.js';

const router = Router();

router.get('/', obtenerTratamientosController);
router.get('/:id', obtenerTratamientoPorIdController);
router.post('/', crearTratamientoController);
router.put('/:id', actualizarTratamientoController);
router.delete('/:id', eliminarTratamientoController);

export default router;
