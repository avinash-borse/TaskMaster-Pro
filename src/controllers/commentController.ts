import { Request, Response } from 'express';
import prisma from '../utils/prisma.js';
import { catchAsync, AppError } from '../utils/errorHandler.js';
import { processMentions } from '../utils/mentionHelper.js';

// Get comments for a task
export const getComments = catchAsync(async (req: Request, res: Response) => {
  const userId = (req.user as any).id as string;
  const taskId = req.params.taskId as string;

  const task = await prisma.task.findFirst({ where: { id: taskId, userId } });
  if (!task) {
    const assignedTask = await prisma.task.findFirst({ where: { id: taskId, assigneeId: userId } });
    if (!assignedTask) throw new AppError('Task not found', 404);
  }

  const comments = await prisma.comment.findMany({
    where: { taskId },
    include: { user: { select: { id: true, username: true, avatarColor: true } } },
    orderBy: { createdAt: 'asc' }
  });
  res.json({ status: 'success', data: { comments } });
});

// Add a comment
export const addComment = catchAsync(async (req: Request, res: Response) => {
  const userId = (req.user as any).id as string;
  const taskId = req.params.taskId as string;
  const { content } = req.body;
  if (!content?.trim()) throw new AppError('Comment content is required', 400);

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw new AppError('Task not found', 404);

  const comment = await prisma.comment.create({
    data: { content: content.trim(), taskId, userId },
    include: { user: { select: { id: true, username: true, avatarColor: true } } }
  });

  await prisma.activityLog.create({
    data: { taskId, userId, action: 'commented', detail: content.trim().slice(0, 80) }
  });

  // Process @mentions (non-blocking)
  processMentions(content, userId, taskId).catch(console.error);

  res.status(201).json({ status: 'success', data: { comment } });
});

// Delete comment
export const deleteComment = catchAsync(async (req: Request, res: Response) => {
  const userId = (req.user as any).id as string;
  const commentId = req.params.commentId as string;
  const comment = await prisma.comment.findUnique({ where: { id: commentId } });
  if (!comment || comment.userId !== userId) throw new AppError('Not authorized', 403);
  await prisma.comment.delete({ where: { id: commentId } });
  res.json({ status: 'success', message: 'Comment deleted' });
});

// Get activity log for a task
export const getActivity = catchAsync(async (req: Request, res: Response) => {
  const taskId = req.params.taskId as string;
  const activities = await prisma.activityLog.findMany({
    where: { taskId },
    include: { user: { select: { id: true, username: true, avatarColor: true } } },
    orderBy: { createdAt: 'desc' },
    take: 50
  });
  res.json({ status: 'success', data: { activities } });
});
