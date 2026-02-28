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

  // Create friendship between user1 and user2 (skip if exists)
  try {
    const friendship = await prisma.friendship.create({
      data: {
        userId1: user1.id,
        userId2: user2.id,
      },
    });
    console.log('Created friendship:', friendship);
  } catch (error) {
    console.log('Friendship already exists, skipping');
  }

  // Create UserConversationState for user1 and user2
  const conversationId = `direct_${user1.id}_${user2.id}`;
  
  await prisma.userConversationState.upsert({
    where: {
      userId_conversationId: {
        userId: user1.id,
        conversationId,
      },
    },
    update: {},
    create: {
      userId: user1.id,
      conversationId,
      type: 'direct',
      targetId: user2.id,
      unreadCount: 0,
    },
  });

  await prisma.userConversationState.upsert({
    where: {
      userId_conversationId: {
        userId: user2.id,
        conversationId,
      },
    },
    update: {},
    create: {
      userId: user2.id,
      conversationId,
      type: 'direct',
      targetId: user1.id,
      unreadCount: 0,
    },
  });

  console.log('Created UserConversationState');

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
