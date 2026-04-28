import { Router } from 'express';
import {
  crearPacienteController,
  obtenerPacientesController,
  obtenerPacientePorIdController,
  actualizarPacienteController,
  eliminarPacienteController
} from '../controllers/pacienteController.js';

const router = Router();

router.get('/', obtenerPacientesController);
router.get('/:id', obtenerPacientePorIdController);
router.post('/', crearPacienteController);
router.put('/:id', actualizarPacienteController);
router.delete('/:id', eliminarPacienteController);

export default router;
