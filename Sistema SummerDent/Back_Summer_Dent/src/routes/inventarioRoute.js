import { Router } from 'express';
import {
    obtenerInventariosController,
    obtenerInventarioPorProductoController,
    aumentarStockController
} from '../controllers/inventarioController.js';
import { registraMovimientoController } from '../controllers/inventarioController.js';

const router = Router();

router.get('/', obtenerInventariosController);
router.get('/producto/:id_producto', obtenerInventarioPorProductoController);
router.post('/aumentar', aumentarStockController);
router.post('/movimiento', registraMovimientoController);

export default router;
