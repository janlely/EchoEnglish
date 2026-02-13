import { database } from './index';
import { ChatSession, Message, User } from './models';
import { Collection } from '@nozbe/watermelondb';

// Initialize the database with sample data
export const initializeDatabase = async () => {
  try {
    // Check if we already have data to avoid duplicating
    const existingSessions = await database.collections.get('chat_sessions').query().fetch();
    
    if (existingSessions.length > 0) {
      console.log('Database already initialized with data');
      return;
    }

    // Create sample users
    const usersData = [
      { id: 'user1', name: '张三', email: 'zhangsan@example.com', isOnline: true },
      { id: 'user2', name: '李四', email: 'lisi@example.com', isOnline: false },
      { id: 'user3', name: '王五', email: 'wangwu@example.com', isOnline: true },
      { id: 'user4', name: '赵六', email: 'zhaoliu@example.com', isOnline: false },
      { id: 'user5', name: '微信群聊', email: 'groupchat@example.com', isOnline: true },
      { id: 'user6', name: '工作群', email: 'workgroup@example.com', isOnline: true },
    ];

    // Create sample chat sessions
    const chatSessionsData = [
      { id: '1', name: '张三', type: 'direct', unreadCount: 3, isOnline: true },
      { id: '2', name: '李四', type: 'direct', unreadCount: 0, isOnline: false },
      { id: '3', name: '王五', type: 'direct', unreadCount: 1, isOnline: true },
      { id: '4', name: '赵六', type: 'direct', unreadCount: 0, isOnline: false },
      { id: '5', name: '微信群聊', type: 'group', unreadCount: 5, isOnline: true },
      { id: '6', name: '工作群', type: 'group', unreadCount: 0, isOnline: true },
    ];

    // Create sample messages
    const messagesData = [
      { id: '1', text: '今天晚上一起吃饭吗？', senderId: 'user1', chatSessionId: '1', status: 'read', timestamp: Date.now() - 3600000 },
      { id: '2', text: '好的，收到', senderId: 'user2', chatSessionId: '2', status: 'read', timestamp: Date.now() - 7200000 },
      { id: '3', text: '会议纪要已发送', senderId: 'user3', chatSessionId: '3', status: 'read', timestamp: Date.now() - 10800000 },
      { id: '4', text: '周末有空吗？', senderId: 'user4', chatSessionId: '4', status: 'delivered', timestamp: Date.now() - 86400000 },
      { id: '5', text: '小明: 大家注意看这个...', senderId: 'user5', chatSessionId: '5', status: 'read', timestamp: Date.now() - 86400000 },
      { id: '6', text: '老板: 明天会议时间调整', senderId: 'user6', chatSessionId: '6', status: 'read', timestamp: Date.now() - 172800000 },
      { id: '7', text: '还不错，谢谢！你在忙什么？', senderId: 'current_user_id', chatSessionId: '1', status: 'read', timestamp: Date.now() - 3500000 },
      { id: '8', text: '在计划周末的活动，你想一起去爬山吗？', senderId: 'user1', chatSessionId: '1', status: 'read', timestamp: Date.now() - 3400000 },
      { id: '9', text: '听起来不错！几点出发？', senderId: 'current_user_id', chatSessionId: '1', status: 'read', timestamp: Date.now() - 3300000 },
      { id: '10', text: '早上8点，在市中心集合怎么样？', senderId: 'user1', chatSessionId: '1', status: 'read', timestamp: Date.now() - 3200000 },
      { id: '11', text: '好的，没问题！到时候见', senderId: 'current_user_id', chatSessionId: '1', status: 'read', timestamp: Date.now() - 3100000 },
    ];

    // Get typed collections
    const usersCollection = database.collections.get('users') as Collection<User>;
    const chatSessionsCollection = database.collections.get('chat_sessions') as Collection<ChatSession>;
    const messagesCollection = database.collections.get('messages') as Collection<Message>;

    // Write sample data to the database
    await database.write(async () => {
      // Create users
      for (const userData of usersData) {
        await usersCollection.create(user => {
          user._raw.id = userData.id;
          user.name = userData.name;
          user.email = userData.email;
          user.isOnline = userData.isOnline;
          user.createdAt = Date.now();
          user.updatedAt = Date.now();
        });
      }

      // Create chat sessions
      for (const sessionData of chatSessionsData) {
        await chatSessionsCollection.create(session => {
          session._raw.id = sessionData.id;
          session.name = sessionData.name;
          session.type = sessionData.type;
          session.unreadCount = sessionData.unreadCount;
          session.isOnline = sessionData.isOnline;
          session.createdAt = Date.now();
          session.updatedAt = Date.now();

          // Set the last message ID to one of the messages in this chat
          if (sessionData.id === '1') {
            session.lastMessageId = '11'; // Last message in chat 1
          } else if (sessionData.id === '2') {
            session.lastMessageId = '2';
          } else if (sessionData.id === '3') {
            session.lastMessageId = '3';
          } else if (sessionData.id === '4') {
            session.lastMessageId = '4';
          } else if (sessionData.id === '5') {
            session.lastMessageId = '5';
          } else if (sessionData.id === '6') {
            session.lastMessageId = '6';
          }
        });
      }

      // Create messages
      for (const messageData of messagesData) {
        await messagesCollection.create(message => {
          message._raw.id = messageData.id;
          message.text = messageData.text;
          message.senderId = messageData.senderId;
          message.chatSessionId = messageData.chatSessionId;
          message.status = messageData.status;
          message.timestamp = messageData.timestamp;
          message.createdAt = Date.now();
          message.updatedAt = Date.now();
        });
      }
    });

    console.log('Database initialized with sample data');
  } catch (error) {
    console.error('Error initializing database:', error);
  }
};