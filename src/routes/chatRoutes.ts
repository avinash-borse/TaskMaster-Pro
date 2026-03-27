import { Router } from 'express';
import { getMessages, sendMessage, getOnlineUsers } from '../controllers/chatController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/messages', getMessages);
router.post('/messages', sendMessage);
router.get('/online', getOnlineUsers);

export default router;
