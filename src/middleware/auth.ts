import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '@prisma/client';
import prisma from '../utils/prisma.js';
import { AppError } from '../utils/errorHandler.js';

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AppError('Unauthorized: Missing or invalid token', 401);
    }
    const token = authHeader.split(' ')[1];
    if (!token) throw new AppError('Unauthorized: Missing token', 401);

    const secret = process.env.JWT_SECRET || 'secret';
    const decoded: any = jwt.verify(token, secret);
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });

    if (!user) throw new AppError('Unauthorized: User no longer exists', 401);
    
    req.user = user;

    // Update lastActive timestamp on each hit (heartbeat)
    await prisma.user.update({
      where: { id: user.id },
      data: { lastActive: new Date() }
    }).catch(err => console.error('Heartbeat update failed', err));

    next();
  } catch (err: any) {
    next(new AppError(err.message || 'Authentication failed', 401));
  }
};
