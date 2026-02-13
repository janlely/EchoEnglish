import { database } from './index';
import { Q } from '@nozbe/watermelondb';
import { ChatSession, Message, User } from './models';

// Utility functions for database operations

// Get all chat sessions
export const getAllChatSessions = async () => {
  try {
    const chatSessions = await database.collections
      .get('chat_sessions')
      .query()
      .fetch();
    return chatSessions;
  } catch (error) {
    console.error('Error getting chat sessions:', error);
    throw error;
  }
};

// Get chat session by ID
export const getChatSessionById = async (id: string) => {
  try {
    const chatSession = await database.collections
      .get('chat_sessions')
      .find(id);
    return chatSession;
  } catch (error) {
    console.error(`Error getting chat session with id ${id}:`, error);
    throw error;
  }
};

// Get messages for a chat session
export const getMessagesByChatSession = async (chatSessionId: string) => {
  try {
    const messages = await database.collections
      .get('messages')
      .query(Q.where('chat_session_id', chatSessionId))
      .fetch();
    return messages;
  } catch (error) {
    console.error(`Error getting messages for chat session ${chatSessionId}:`, error);
    throw error;
  }
};

// Create a new chat session
export const createChatSession = async (data: Partial<ChatSession>) => {
  try {
    const newChatSession = await database.write(async () => {
      return database.collections.get('chat_sessions').create(chatSession => {
        Object.assign(chatSession, data);
      });
    });
    return newChatSession;
  } catch (error) {
    console.error('Error creating chat session:', error);
    throw error;
  }
};

// Create a new message
export const createMessage = async (data: Partial<Message>) => {
  try {
    const newMessage = await database.write(async () => {
      return database.collections.get('messages').create(message => {
        Object.assign(message, data);
      });
    });
    return newMessage;
  } catch (error) {
    console.error('Error creating message:', error);
    throw error;
  }
};

// Update chat session last message
export const updateChatSessionLastMessage = async (chatSessionId: string, messageId: string) => {
  try {
    const chatSession = await getChatSessionById(chatSessionId) as ChatSession;
    if (!chatSession) {
      throw new Error(`Chat session with id ${chatSessionId} not found`);
    }
    
    await database.write(async () => {
      await chatSession.update(chatSession => {
        chatSession.lastMessageId = messageId;
        chatSession.updatedAt = Date.now();
      });
    });
    
    return chatSession;
  } catch (error) {
    console.error('Error updating chat session last message:', error);
    throw error;
  }
};

// Increment unread count for a chat session
export const incrementUnreadCount = async (chatSessionId: string) => {
  try {
    const chatSession = await getChatSessionById(chatSessionId) as ChatSession;
    if (!chatSession) {
      throw new Error(`Chat session with id ${chatSessionId} not found`);
    }
    
    await database.write(async () => {
      await chatSession.update(chatSession => {
        chatSession.unreadCount = (chatSession.unreadCount || 0) + 1;
        chatSession.updatedAt = Date.now();
      });
    });
    
    return chatSession;
  } catch (error) {
    console.error('Error incrementing unread count:', error);
    throw error;
  }
};

// Reset unread count for a chat session
export const resetUnreadCount = async (chatSessionId: string) => {
  try {
    const chatSession = await getChatSessionById(chatSessionId) as ChatSession;
    if (!chatSession) {
      throw new Error(`Chat session with id ${chatSessionId} not found`);
    }
    
    await database.write(async () => {
      await chatSession.update(chatSession => {
        chatSession.unreadCount = 0;
        chatSession.updatedAt = Date.now();
      });
    });
    
    return chatSession;
  } catch (error) {
    console.error('Error resetting unread count:', error);
    throw error;
  }
};