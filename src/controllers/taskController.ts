import { Request, Response } from 'express';
import prisma from '../utils/prisma.js';
import { TaskStatus, TaskPriority } from '../utils/constants.js';
import { catchAsync, AppError } from '../utils/errorHandler.js';
import { taskBodySchema, updateTaskBodySchema, taskQuerySchema } from '../schemas/taskSchema.js';

const TASK_INCLUDE = {
  creator: { select: { id: true, username: true, avatarColor: true } },
  assignee: { select: { id: true, username: true, avatarColor: true } },
  workspace: { select: { id: true, name: true } },
  _count: { select: { comments: true, files: true, activityLog: true } }
};

// Get tasks with filtering, pagination, sorting
export const getTasks = catchAsync(async (req: Request, res: Response) => {
  const queryParams = taskQuerySchema.safeParse(req.query);
  if (!queryParams.success) throw new AppError('Invalid query parameters', 400);
  const { status, priority, overdue, page = 1, limit = 200, sortBy = 'createdAt', sortOrder = 'desc' } = queryParams.data;

  const userId = (req.user as any).id;
  const workspaceId = req.query.workspaceId as string | undefined;

  // Build where clause
  const where: any = workspaceId
    ? { workspaceId } // workspace tasks (all members can see)
    : { OR: [{ userId }, { assigneeId: userId }] }; // personal: own + assigned

  if (status) where.status = status;
  if (priority) where.priority = priority;
  if (overdue) {
    where.dueDate = { lt: new Date() };
    where.status = { not: TaskStatus.COMPLETED };
  }

  const allowedSortFields = ['createdAt', 'dueDate', 'priority', 'title', 'status', 'updatedAt'];
  const finalSortBy = allowedSortFields.includes(sortBy || '') ? (sortBy as string) : 'createdAt';

  const [total, tasks] = await Promise.all([
    prisma.task.count({ where }),
    prisma.task.findMany({
      where,
      include: TASK_INCLUDE,
      orderBy: { [finalSortBy]: sortOrder as 'asc' | 'desc' },
      skip: (page - 1) * (limit || 10),
      take: limit || 10
    })
  ]);

  res.json({ status: 'success', data: { tasks, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } } });
});

// Create task
export const createTask = catchAsync(async (req: Request, res: Response) => {
  const parseResult = taskBodySchema.safeParse(req.body);
  if (!parseResult.success) throw new AppError(parseResult.error.issues[0]?.message || 'Invalid input data', 400);

  const userId = (req.user as any).id;
  const { assigneeId, workspaceId } = req.body;

  const task = await prisma.task.create({
    data: {
      title: parseResult.data.title,
      description: parseResult.data.description || null,
      tags: parseResult.data.tags || null,
      priority: parseResult.data.priority,
      status: parseResult.data.status || TaskStatus.PENDING,
      dueDate: parseResult.data.dueDate || null,
      userId,
      assigneeId: assigneeId || null,
      workspaceId: workspaceId || null
    },
    include: TASK_INCLUDE
  });

  await prisma.activityLog.create({ data: { taskId: task.id, userId, action: 'created', detail: task.title } });
  if (assigneeId && assigneeId !== userId) {
    await prisma.activityLog.create({ data: { taskId: task.id, userId, action: 'assigned', detail: assigneeId } });
  }

  res.status(201).json({ status: 'success', data: { task } });
});

// Get task by ID
export const getTaskById = catchAsync(async (req: Request, res: Response) => {
  const userId = (req.user as any).id as string;
  const taskId = req.params.id as string;
  const task = await prisma.task.findFirst({
    where: { id: taskId, OR: [{ userId }, { assigneeId: userId }] },
    include: TASK_INCLUDE
  });
  if (!task) throw new AppError('Task not found', 404);
  res.json({ status: 'success', data: { task } });
});

// Update task
export const updateTask = catchAsync(async (req: Request, res: Response) => {
  const taskId = req.params.id as string;
  const userId = (req.user as any).id as string;

  const parseResult = updateTaskBodySchema.safeParse(req.body);
  if (!parseResult.success) throw new AppError(parseResult.error.issues[0]?.message || 'Invalid update data', 400);

  const existing = await prisma.task.findFirst({ where: { id: taskId, OR: [{ userId }, { assigneeId: userId }] } });
  if (!existing) throw new AppError('Task not found', 404);

  // Build update data — include explicit nulls from body (for un-assigning / removing workspace)
  const updateData: any = { ...parseResult.data };
  if ('assigneeId' in req.body) updateData.assigneeId = req.body.assigneeId ?? null;
  if ('workspaceId' in req.body) updateData.workspaceId = req.body.workspaceId ?? null;

  // Activity logs
  const logs: { taskId: string; userId: string; action: string; detail?: string }[] = [];
  if (updateData.status && updateData.status !== existing.status) {
    logs.push({ taskId, userId, action: 'status_changed', detail: `${existing.status} → ${updateData.status}` });
  }
  if (updateData.title && updateData.title !== existing.title) {
    logs.push({ taskId, userId, action: 'edited', detail: 'Title updated' });
  }
  if ('assigneeId' in updateData && updateData.assigneeId !== existing.assigneeId) {
    logs.push({ taskId, userId, action: 'assigned', detail: updateData.assigneeId ? `to ${updateData.assigneeId}` : 'removed' });
  }
  if ('workspaceId' in updateData && updateData.workspaceId !== existing.workspaceId) {
    logs.push({ taskId, userId, action: 'moved', detail: updateData.workspaceId ? `to workspace ${updateData.workspaceId}` : 'to Personal' });
  }

  const updatedTask = await prisma.task.update({
    where: { id: taskId },
    data: updateData,
    include: TASK_INCLUDE
  });

  if (logs.length) await prisma.activityLog.createMany({ data: logs });

  res.json({ status: 'success', data: { task: updatedTask } });
});


// Delete task
export const deleteTask = catchAsync(async (req: Request, res: Response) => {
  const taskId = req.params.id as string;
  const userId = (req.user as any).id;
  const task = await prisma.task.findFirst({ where: { id: taskId, userId } });
  if (!task) throw new AppError('Task not found or not authorized', 404);
  await prisma.task.delete({ where: { id: taskId } });
  res.status(204).send();
});

// Summary statistics
export const getSummary = catchAsync(async (req: Request, res: Response) => {
  const userId = (req.user as any).id;
  const now = new Date();
  const where = { OR: [{ userId }, { assigneeId: userId }] };

  const [total, completed, pending, inProgress, overdue] = await Promise.all([
    prisma.task.count({ where }),
    prisma.task.count({ where: { ...where, status: TaskStatus.COMPLETED } }),
    prisma.task.count({ where: { ...where, status: TaskStatus.PENDING } }),
    prisma.task.count({ where: { ...where, status: TaskStatus.IN_PROGRESS } }),
    prisma.task.count({ where: { ...where, dueDate: { lt: now }, status: { not: TaskStatus.COMPLETED } } })
  ]);

  res.json({ status: 'success', data: { summary: { total, completed, pending, inProgress, overdue } } });
});

// Get upcoming tasks for reminders (due in next 24h)
export const getUpcoming = catchAsync(async (req: Request, res: Response) => {
  const userId = (req.user as any).id;
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const tasks = await prisma.task.findMany({
    where: {
      OR: [{ userId }, { assigneeId: userId }],
      status: { not: TaskStatus.COMPLETED },
      dueDate: { gte: now, lte: in24h }
    },
    select: { id: true, title: true, dueDate: true, priority: true },
    orderBy: { dueDate: 'asc' }
  });

  res.json({ status: 'success', data: { tasks } });
});
