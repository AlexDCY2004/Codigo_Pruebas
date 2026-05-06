import { Router } from 'express';
import {
    crearProductoController,
    obtenerProductosController,
    obtenerProductoPorIdController,
    actualizarProductoController,
    eliminarProductoController
} from '../controllers/productoController.js';

const router = Router();

router.get('/', obtenerProductosController);
router.get('/:id', obtenerProductoPorIdController);
router.post('/', crearProductoController);
router.put('/:id', actualizarProductoController);
router.delete('/:id', eliminarProductoController);

export default router;
