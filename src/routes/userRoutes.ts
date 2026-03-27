import { Router } from 'express';
import {
  register, login, searchUsers,
  updateProfile, getNotifications, markNotificationsRead
} from '../controllers/userController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/search', authenticate, searchUsers);
router.put('/profile', authenticate, updateProfile);
router.get('/notifications', authenticate, getNotifications);
router.patch('/notifications/read', authenticate, markNotificationsRead);

export default router;
