import { Request, Response } from 'express';
import prisma from '../utils/prisma.js';

export const getMessages = async (req: Request, res: Response) => {
  try {
    const messages = await prisma.message.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        user: {
          select: { id: true, username: true, avatarColor: true }
        }
      }
    });
    res.json(messages.reverse());
  } catch (error) {
    res.status(500).json({ message: 'Error fetching messages' });
  }
};

export const sendMessage = async (req: Request, res: Response) => {
  try {
    const { content } = req.body;
    if (!content) return res.status(400).json({ message: 'Content is required' });

    const message = await prisma.message.create({
      data: {
        content,
        userId: (req as any).user.id
      },
      include: {
        user: {
          select: { id: true, username: true, avatarColor: true }
        }
      }
    });

    // Update lastActive when sending a message
    await prisma.user.update({
      where: { id: (req as any).user.id },
      data: { lastActive: new Date() }
    });

    res.status(201).json(message);
  } catch (error) {
    res.status(500).json({ message: 'Error sending message' });
  }
};

export const getOnlineUsers = async (req: Request, res: Response) => {
  try {
    // Users active in the last 5 minutes are considered online
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    const onlineUsers = await prisma.user.findMany({
      where: {
        lastActive: { gte: fiveMinutesAgo }
      },
      select: {
        id: true,
        username: true,
        avatarColor: true,
        lastActive: true
      },
      orderBy: { lastActive: 'desc' }
    });
    
    res.json(onlineUsers);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching online users' });
  }
};
