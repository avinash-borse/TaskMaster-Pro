import { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import prisma from '../utils/prisma.js';
import { catchAsync, AppError } from '../utils/errorHandler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.join(__dirname, '../../public/uploads');

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  }
});

export const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|pdf|doc|docx|txt|xlsx|csv|zip/;
    if (allowed.test(path.extname(file.originalname).toLowerCase().slice(1))) return cb(null, true);
    cb(new Error('File type not allowed'));
  }
});

// Get files for task
export const getFiles = catchAsync(async (req: Request, res: Response) => {
  const taskId = req.params.taskId as string;
  const files = await prisma.taskFile.findMany({
    where: { taskId },
    include: { user: { select: { username: true } } },
    orderBy: { createdAt: 'desc' }
  });
  res.json({ status: 'success', data: { files } });
});

// Upload file to task
export const uploadFile = catchAsync(async (req: Request, res: Response) => {
  const userId = (req.user as any).id as string;
  const taskId = req.params.taskId as string;
  const file = (req as any).file;
  if (!file) throw new AppError('No file provided', 400);

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw new AppError('Task not found', 404);

  const record = await prisma.taskFile.create({
    data: {
      taskId,
      filename: file.filename as string,
      originalName: file.originalname as string,
      mimetype: file.mimetype as string,
      size: file.size as number,
      uploadedBy: userId
    },
    include: { user: { select: { username: true } } }
  });

  await prisma.activityLog.create({
    data: { taskId, userId, action: 'file_uploaded', detail: file.originalname as string }
  });

  res.status(201).json({ status: 'success', data: { file: record } });
});

// Delete file
export const deleteFile = catchAsync(async (req: Request, res: Response) => {
  const userId = (req.user as any).id as string;
  const fileId = req.params.fileId as string;
  const file = await prisma.taskFile.findUnique({ where: { id: fileId } });
  if (!file || file.uploadedBy !== userId) throw new AppError('Not authorized', 403);

  const filePath = path.join(UPLOADS_DIR, file.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  await prisma.taskFile.delete({ where: { id: fileId } });
  res.json({ status: 'success', message: 'File deleted' });
});
