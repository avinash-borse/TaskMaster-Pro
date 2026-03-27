import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  try {
    const count = await prisma.user.count();
    console.log('USER_COUNT:', count);
    if (count > 0) {
        const users = await prisma.user.findMany({ select: { username: true, avatarColor: true, theme: true } });
        console.log('USERS_PREVIEW:', JSON.stringify(users, null, 2));
    }
  } catch (e) {
    console.error('ERROR_CHECKING_USERS:', e)
  } finally {
    await prisma.$disconnect()
  }
}

main()
