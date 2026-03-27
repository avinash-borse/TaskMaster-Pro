import prisma from '../utils/prisma.js';

/**
 * Scans text for @username mentions and creates notifications for found users.
 */
export const processMentions = async (text: string, senderId: string, taskId: string | null = null) => {
  try {
    const mentionRegex = /@(\w+)/g;
    const matches = [...text.matchAll(mentionRegex)];
    if (matches.length === 0) return;

    // Get unique usernames mentioned
    const mentionedUsernames = [...new Set(matches.map(m => m[1]))];

    // Find users by username
    const users = await prisma.user.findMany({
      where: {
        username: { in: mentionedUsernames },
        id: { not: senderId } // Don't notify self
      },
      select: { id: true, username: true }
    });

    if (users.length === 0) return;

    const sender = await prisma.user.findUnique({ where: { id: senderId }, select: { username: true } });

    // Create notifications
    const notificationData = users.map(user => ({
      userId: user.id,
      taskId: taskId,
      type: 'mention',
      content: `@${sender?.username} mentioned you: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`
    }));

    await prisma.notification.createMany({
      data: notificationData
    });
    
  } catch (error) {
    console.error('Error processing mentions:', error);
  }
};
