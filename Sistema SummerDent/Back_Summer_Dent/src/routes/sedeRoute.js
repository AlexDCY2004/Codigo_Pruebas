import { Router } from 'express';
import {
    obtenerSedesController,
    obtenerSedePorIdController,
    crearSedeController,
    actualizarSedeController,
    eliminarSedeController
} from '../controllers/sedeController.js';

const router = Router();

router.get('/', obtenerSedesController);
router.get('/:id', obtenerSedePorIdController);
router.post('/', crearSedeController);
router.put('/:id', actualizarSedeController);
router.delete('/:id', eliminarSedeController);

export default router;
