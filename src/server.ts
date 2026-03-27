import dotenv from 'dotenv';
import prisma from './utils/prisma.js';
import app from './app.js';

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;

prisma.$connect()
  .then(() => {
    console.log('✅ PostgreSQL Database Ready (Supabase)');
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server fully live on port ${PORT}`);
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
