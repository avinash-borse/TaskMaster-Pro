import { Router } from 'express';
import { getWorkspaces, createWorkspace, inviteMember, removeMember } from '../controllers/workspaceController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

router.get('/', getWorkspaces);
router.post('/', createWorkspace);
router.post('/:workspaceId/invite', inviteMember);
router.delete('/:workspaceId/members/:memberId', removeMember);

export default router;
