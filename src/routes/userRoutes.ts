import { Router } from 'express';
import * as userController from '../controllers/userController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.post('/register', userController.register);
router.post('/login', userController.login);
router.get('/search', authenticate, userController.searchUsers);

export default router;
