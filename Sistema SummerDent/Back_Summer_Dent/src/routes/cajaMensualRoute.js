import { Router } from 'express';
import {
  obtenerCajaActualController,
  obtenerHistorialController,
  crearCajaController,
  actualizarCajaController,
  cerrarCajaController
} from '../controllers/cajaMensualController.js';

const router = Router();

router.get('/', obtenerCajaActualController);
router.get('/history', obtenerHistorialController);
router.post('/', crearCajaController);
router.put('/:id', actualizarCajaController);
router.post('/:id/close', cerrarCajaController);

export default router;
