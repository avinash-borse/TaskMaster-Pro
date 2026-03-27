import { Router } from 'express';
import * as taskController from '../controllers/taskController.js';
import { getComments, addComment, deleteComment, getActivity } from '../controllers/commentController.js';
import { getFiles, uploadFile, deleteFile, upload } from '../controllers/fileController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

router.route('/').post(taskController.createTask).get(taskController.getTasks);
router.get('/summary', taskController.getSummary);
router.get('/upcoming', taskController.getUpcoming);

router.route('/:id').get(taskController.getTaskById).put(taskController.updateTask).patch(taskController.updateTask).delete(taskController.deleteTask);

// Comments
router.get('/:taskId/comments', getComments);
router.post('/:taskId/comments', addComment);
router.delete('/:taskId/comments/:commentId', deleteComment);

// Activity log
router.get('/:taskId/activity', getActivity);

// File uploads
router.get('/:taskId/files', getFiles);
router.post('/:taskId/files', upload.single('file'), uploadFile);
router.delete('/:taskId/files/:fileId', deleteFile);

export default router;
