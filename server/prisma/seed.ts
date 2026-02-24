import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding...');

  // Create test users
  const passwordHash = await bcrypt.hash('password123', 12);

  const user1 = await prisma.user.upsert({
    where: { email: 'test1@example.com' },
    update: {},
    create: {
      email: 'test1@example.com',
      name: 'Test User 1',
      passwordHash,
      avatarUrl: 'https://ui-avatars.com/api/?name=Test+User+1&background=random',
      settings: {
        create: {
          language: 'en',
          theme: 'light',
          notifications: true,
        },
      },
    },
  });

  const user2 = await prisma.user.upsert({
    where: { email: 'test2@example.com' },
    update: {},
    create: {
      email: 'test2@example.com',
      name: 'Test User 2',
      passwordHash,
      avatarUrl: 'https://ui-avatars.com/api/?name=Test+User+2&background=random',
      settings: {
        create: {
          language: 'en',
          theme: 'dark',
          notifications: true,
        },
      },
    },
  });

  const user3 = await prisma.user.upsert({
    where: { email: 'test3@example.com' },
    update: {},
    create: {
      email: 'test3@example.com',
      name: 'Test User 3',
      passwordHash,
      avatarUrl: 'https://ui-avatars.com/api/?name=Test+User+3&background=random',
      settings: {
        create: {
          language: 'zh',
          theme: 'light',
          notifications: false,
        },
      },
    },
  });

  console.log('Created users:', { user1, user2, user3 });

  // Create a chat session between user1 and user2
  const chatSession = await prisma.chatSession.create({
    data: {
      type: 'direct',
      participants: {
        create: [
          { userId: user1.id, role: 'admin' },
          { userId: user2.id, role: 'member' },
        ],
      },
    },
    include: {
      participants: true,
    },
  });

  console.log('Created chat session:', chatSession);

  // Create notifications
  await prisma.notification.createMany({
    data: [
      {
        userId: user1.id,
        type: 'system',
        title: 'Welcome to EchoEnglish',
        message: 'Thank you for joining EchoEnglish! Start chatting now.',
        isRead: false,
      },
      {
        userId: user2.id,
        type: 'message',
        title: 'New message',
        message: 'Test User 1: Want to grab lunch later?',
        isRead: false,
      },
    ],
  });

  console.log('Created notifications');

  console.log('Seeding finished!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
