import { Request, Response } from 'express';
import prisma from '../utils/prisma.js';
import { catchAsync, AppError } from '../utils/errorHandler.js';

export const getWorkspaces = catchAsync(async (req: Request, res: Response) => {
  const userId = (req.user as any).id as string;
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId },
    include: { workspace: { include: { members: { include: { user: { select: { id: true, username: true, email: true, avatarColor: true } } } } } } }
  });
  const workspaces = memberships.map((m: any) => ({ ...m.workspace, myRole: m.role }));
  res.json({ status: 'success', data: { workspaces } });
});

export const createWorkspace = catchAsync(async (req: Request, res: Response) => {
  const userId = (req.user as any).id as string;
  const { name, description } = req.body;
  if (!name) throw new AppError('Workspace name required', 400);

  const ws = await prisma.workspace.create({
    data: {
      name, description: description || null, ownerId: userId,
      members: { create: { userId, role: 'owner' } }
    },
    include: { members: { include: { user: { select: { id: true, username: true, email: true, avatarColor: true } } } } }
  });
  res.status(201).json({ status: 'success', data: { workspace: ws } });
});

export const inviteMember = catchAsync(async (req: Request, res: Response) => {
  const userId = (req.user as any).id as string;
  const workspaceId = req.params.workspaceId as string;
  const { email, role = 'member' } = req.body;

  const membership = await prisma.workspaceMember.findFirst({
    where: { workspaceId, userId, role: { in: ['owner', 'admin'] } }
  });
  if (!membership) throw new AppError('Not authorized to invite members', 403);

  const invitee = await prisma.user.findUnique({ where: { email } });
  if (!invitee) throw new AppError('No user found with that email', 404);

  const exists = await prisma.workspaceMember.findFirst({ where: { workspaceId, userId: invitee.id } });
  if (exists) throw new AppError('User is already a member', 400);

  await prisma.workspaceMember.create({ data: { workspaceId, userId: invitee.id, role } });
  res.json({ status: 'success', message: `${invitee.username} added to workspace` });
});

export const removeMember = catchAsync(async (req: Request, res: Response) => {
  const userId = (req.user as any).id as string;
  const workspaceId = req.params.workspaceId as string;
  const memberId = req.params.memberId as string;

  const ws = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!ws || ws.ownerId !== userId) throw new AppError('Only the owner can remove members', 403);
  if (memberId === userId) throw new AppError('Cannot remove yourself as owner', 400);

  await prisma.workspaceMember.deleteMany({ where: { workspaceId, userId: memberId } });
  res.json({ status: 'success', message: 'Member removed' });
});
