import { Request, Response } from 'express';
import prisma from '../utils/prisma.js';
import { processMentions } from '../utils/mentionHelper.js';

export const getMessages = async (req: Request, res: Response) => {
  try {
    const { type, targetId, since } = req.query as any;
    const userId = (req as any).user.id;

    const where: any = {};
    if (type === 'global') {
        where.receiverId = null;
        where.groupId = null;
    } else if (type === 'private' && targetId) {
        where.OR = [
            { userId: userId, receiverId: targetId },
            { userId: targetId, receiverId: userId }
        ];
    } else if (type === 'group' && targetId) {
        where.groupId = targetId;
    } else {
        // Fallback for old clients or default view
        where.receiverId = null;
        where.groupId = null;
    }

    if (since) {
        where.createdAt = { gt: new Date(since) };
    }

    const messages = await prisma.message.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take: 50,
      include: {
        user: {
          select: { id: true, username: true, avatarColor: true }
        }
      }
    });
    
    res.json({ status: 'success', data: { messages } });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Error fetching messages' });
  }
};

export const sendMessage = async (req: Request, res: Response) => {
  try {
    const { content, type, receiverId, groupId } = req.body;
    if (!content) return res.status(400).json({ message: 'Content is required' });

    const message = await prisma.message.create({
      data: {
        content,
        userId: (req as any).user.id,
        receiverId: type === 'private' ? receiverId : null,
        groupId: type === 'group' ? groupId : null
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

    // Process @mentions asynchronously
    processMentions(content, (req as any).user.id).catch(console.error);

    res.status(201).json({ status: 'success', data: { message } });
  } catch (error) {
    console.error('SEND_ERR:', error);
    res.status(500).json({ status: 'error', message: 'Error sending message' });
  }
};

export const getOnlineUsers = async (req: Request, res: Response) => {
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const users = await prisma.user.findMany({
      where: { lastActive: { gte: fiveMinutesAgo } },
      select: { id: true, username: true, avatarColor: true, lastActive: true },
      orderBy: { lastActive: 'desc' }
    });
    res.json({ status: 'success', data: { users } });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Error fetching online users' });
  }
};

export const getGroups = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const groups = await prisma.chatGroup.findMany({
            where: { members: { some: { id: userId } } },
            orderBy: { createdAt: 'desc' }
        });
        res.json({ status: 'success', data: { groups } });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Error fetching groups' });
    }
};

export const createGroup = async (req: Request, res: Response) => {
    try {
        const { name, description, memberIds } = req.body;
        const creatorId = (req as any).user.id;

        const group = await prisma.chatGroup.create({
            data: {
                name,
                description,
                creatorId,
                members: {
                    connect: (memberIds || []).map((id: string) => ({ id }))
                }
            }
        });

        res.status(201).json({ status: 'success', data: { group } });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Error creating group' });
    }
};

export const getUnreadCount = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const { lastCheck } = req.query as any;
        const since = lastCheck ? new Date(lastCheck) : new Date(Date.now() - 24 * 60 * 60 * 1000);

        const unreadCount = await prisma.message.count({
            where: {
                createdAt: { gt: since },
                NOT: { userId: userId },
                OR: [
                    { receiverId: userId },
                    { groupId: { not: null }, group: { members: { some: { id: userId } } } }
                ]
            }
        });

        res.json({ status: 'success', data: { unreadCount } });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Error checking unread messages' });
    }
};
