import { Router } from 'express';
import {
  crearCitaController,
  obtenerCitasController,
  obtenerCitaPorIdController,
  actualizarCitaController,
  eliminarCitaController
} from '../controllers/citaController.js';

const router = Router();

router.get('/', obtenerCitasController);
router.get('/:id', obtenerCitaPorIdController);
router.post('/', crearCitaController);
router.put('/:id', actualizarCitaController);
router.delete('/:id', eliminarCitaController);

export default router;
