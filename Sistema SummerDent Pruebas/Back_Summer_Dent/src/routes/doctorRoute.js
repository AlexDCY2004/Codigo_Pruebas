import { Router } from 'express';
import {
    crearDoctorController,
    obtenerDoctoresController,
    obtenerDoctorPorIdController,
    actualizarDoctorController,
    eliminarDoctorController
} from '../controllers/doctorController.js';

const router = Router();

router.get('/', obtenerDoctoresController);
router.get('/:id', obtenerDoctorPorIdController);
router.post('/', crearDoctorController);
router.put('/:id', actualizarDoctorController);
router.delete('/:id', eliminarDoctorController);

export default router;
