import dotenv from 'dotenv';
import prisma from './utils/prisma.js';
import app from './app.js';

dotenv.config();

const PORT = process.env.PORT || 3000;

// Verify Prisma connection (SQLite check is fast)
prisma.$connect()
  .then(() => {
    console.log('✅ SQLite Database Ready (Prisma)');
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err: any) => {
    console.error('❌ Database connection error:', err);
    process.exit(1);
  });

// Handle unhandled rejections
process.on('unhandledRejection', (err: any) => {
  console.log('UNHANDLED REJECTION! 💥 Shutting down...');
  console.error(err);
  process.exit(1);
});
