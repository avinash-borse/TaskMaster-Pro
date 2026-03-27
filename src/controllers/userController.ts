import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import prisma from '../utils/prisma.js';
import { catchAsync, AppError } from '../utils/errorHandler.js';
import { registerUserSchema, loginUserSchema } from '../schemas/userSchema.js';

const generateToken = (id: string): string => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'secret', {
    expiresIn: (process.env.JWT_EXPIRES_IN as any) || '1d'
  });
};

export const register = catchAsync(async (req: Request, res: Response) => {
  const result = registerUserSchema.safeParse(req.body);
  if (!result.success) throw new AppError(result.error.issues[0]?.message || 'Invalid registration data', 400);
  const { username, email, password } = result.data;
  
  const existing = await prisma.user.findFirst({ where: { OR: [{ email }, { username }] } });
  if (existing) throw new AppError('User already exists with this email or username', 400);

  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = await prisma.user.create({ data: { username, email, password: hashedPassword } });
  const token = generateToken(newUser.id);
  res.status(201).json({
    status: 'success',
    data: { token, user: { id: newUser.id, username: newUser.username, email: newUser.email, avatarColor: newUser.avatarColor } }
  });
});

export const login = catchAsync(async (req: Request, res: Response) => {
  const result = loginUserSchema.safeParse(req.body);
  if (!result.success) throw new AppError(result.error.issues[0]?.message || 'Invalid login data', 400);
  const { email, password } = result.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.password))) throw new AppError('Invalid email or password', 401);

  const token = generateToken(user.id);
  res.status(200).json({
    status: 'success',
    data: { token, user: { id: user.id, username: user.username, email: user.email, avatarColor: user.avatarColor } }
  });
});

// Search users by username or email (used for quick task assignment - no workspace needed)
export const searchUsers = catchAsync(async (req: Request, res: Response) => {
  const requesterId = (req.user as any).id as string;
  const q = (req.query.q as string || '').trim();
  if (!q || q.length < 2) return res.json({ status: 'success', data: { users: [] } });

  const users = await prisma.user.findMany({
    where: {
      id: { not: requesterId },
      OR: [
        { username: { contains: q } },
        { email: { contains: q } }
      ]
    },
    select: { id: true, username: true, email: true, avatarColor: true },
    take: 8
  });
  res.json({ status: 'success', data: { users } });
});

export const updateProfile = catchAsync(async (req: Request, res: Response) => {
  const { username, email, avatarColor, theme, currentPassword, newPassword } = req.body;
  const userId = (req.user as any).id;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError('User not found', 404);

  const updateData: any = {};
  if (username) updateData.username = username;
  if (email) updateData.email = email;
  if (avatarColor) updateData.avatarColor = avatarColor;
  if (theme) updateData.theme = theme;

  if (newPassword) {
    if (!currentPassword) throw new AppError('Current password required to change password', 400);
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) throw new AppError('Incorrect current password', 401);
    updateData.password = await bcrypt.hash(newPassword, 10);
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: updateData,
    select: { id: true, username: true, email: true, avatarColor: true, theme: true }
  });

  res.json({ status: 'success', data: { user: updatedUser } });
});

export const getNotifications = catchAsync(async (req: Request, res: Response) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: (req.user as any).id },
    orderBy: { createdAt: 'desc' },
    take: 20
  });
  res.json({ status: 'success', data: { notifications } });
});

export const markNotificationsRead = catchAsync(async (req: Request, res: Response) => {
  await prisma.notification.updateMany({
    where: { userId: (req.user as any).id, isRead: false },
    data: { isRead: true }
  });
  res.json({ status: 'success', message: 'Notifications marked as read' });
});

