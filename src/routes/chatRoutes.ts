import { Router } from 'express';
import { getMessages, sendMessage, getOnlineUsers, getGroups, createGroup } from '../controllers/chatController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/messages', getMessages);
router.post('/messages', sendMessage);
router.get('/online', getOnlineUsers);
router.get('/groups', getGroups);
router.post('/groups', createGroup);

export default router;
