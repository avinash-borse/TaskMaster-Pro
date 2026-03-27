import { Router } from 'express';
import { getMessages, sendMessage, getOnlineUsers, getGroups, createGroup, getUnreadCount } from '../controllers/chatController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/messages', getMessages);
router.post('/messages', sendMessage);
router.get('/online', getOnlineUsers);
router.get('/groups', getGroups);
router.post('/groups', createGroup);
router.get('/unread', getUnreadCount);

export default router;
