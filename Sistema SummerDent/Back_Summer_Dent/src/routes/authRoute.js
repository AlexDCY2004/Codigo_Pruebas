import { Router } from 'express';
import {
    loginController,
    registroController,
    obtenerPerfilController,
    refreshController,
    logoutController
} from '../controllers/authController.js';

const router = Router();

router.post('/login', loginController);
router.post('/refresh', refreshController);
router.post('/logout', logoutController);
router.post('/registro', registroController);
router.get('/perfil', obtenerPerfilController);

export default router;
