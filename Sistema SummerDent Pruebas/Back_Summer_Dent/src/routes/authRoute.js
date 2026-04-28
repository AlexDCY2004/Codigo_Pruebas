import { Router } from 'express';
import {
    loginController,
    registroController,
    obtenerPerfilController
} from '../controllers/authController.js';

const router = Router();

router.post('/login', loginController);
router.post('/registro', registroController);
router.get('/perfil', obtenerPerfilController);

export default router;
