import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server } from 'http';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import logger from '../utils/logger';
import { TokenPayload } from '../types';
import chatService from './chat.service';
import messageService from './message.service';
import notificationService from './notification.service';

interface AuthSocket extends Socket {
  userId?: string;
  email?: string;
}

class WebSocketService {
  private io: SocketIOServer | null = null;
  private userSockets: Map<string, Set<string>> = new Map(); // userId -> Set of socketIds

  /**
   * Initialize WebSocket server
   */
  init(httpServer: Server) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: config.corsOrigin,
        methods: ['GET', 'POST'],
        credentials: true,
      },
      path: '/socket.io',
    });

    this.io.use(async (socket: AuthSocket, next) => {
      try {
        const token = socket.handshake.auth.token;

        if (!token) {
          return next(new Error('Authentication required'));
        }

        const decoded = jwt.verify(token, config.jwt.secret) as TokenPayload;

        if (decoded.type !== 'access') {
          return next(new Error('Invalid token type'));
        }

        socket.userId = decoded.userId;
        socket.email = decoded.email;

        next();
      } catch (error: any) {
        logger.error('WebSocket authentication error:', error);
        next(new Error('Authentication failed'));
      }
    });

    this.io.on('connection', (socket: AuthSocket) => {
      this.handleConnection(socket);
    });

    logger.info('WebSocket server initialized');

    return this.io;
  }

  /**
   * Handle socket connection
   */
  private handleConnection(socket: AuthSocket) {
    const userId = socket.userId!;
    const email = socket.email!;

    logger.info(`User connected: ${email} (${socket.id})`);

    // Track user's sockets
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)!.add(socket.id);

    // Join user's personal room
    socket.join(`user:${userId}`);

    // Broadcast user online status
    this.broadcastUserStatus(userId, true);

    // Handle chat room joining
    socket.on('join_chat', (chatSessionId: string) => {
      socket.join(`chat:${chatSessionId}`);
      logger.info(`User ${userId} joined chat ${chatSessionId}`);
    });

    // Handle leaving chat room
    socket.on('leave_chat', (chatSessionId: string) => {
      socket.leave(`chat:${chatSessionId}`);
      logger.info(`User ${userId} left chat ${chatSessionId}`);
    });

    // Handle sending message
    socket.on('send_message', async (data: { chatSessionId: string; text: string; type?: string }) => {
      try {
        const message = await messageService.sendMessage(
          data.chatSessionId,
          userId,
          data.text,
          (data.type as any) || 'text'
        );

        // Broadcast to chat room
        this.io?.to(`chat:${data.chatSessionId}`).emit('receive_message', message);

        // Send notification to other participants
        await this.sendNotificationToOthers(data.chatSessionId, userId, message);

        logger.info(`Message sent via WebSocket: ${message.id}`);
      } catch (error: any) {
        socket.emit('error', { message: error.message });
      }
    });

    // Handle message read
    socket.on('mark_read', async (data: { chatSessionId: string }) => {
      try {
        await messageService.markMessagesAsRead(data.chatSessionId, userId);
        
        // Notify others in the chat
        socket.to(`chat:${data.chatSessionId}`).emit('messages_read', {
          chatSessionId: data.chatSessionId,
          userId,
        });

        logger.info(`Messages marked as read via WebSocket: ${data.chatSessionId}`);
      } catch (error: any) {
        socket.emit('error', { message: error.message });
      }
    });

    // Handle typing indicator
    socket.on('typing_start', (data: { chatSessionId: string }) => {
      socket.to(`chat:${data.chatSessionId}`).emit('user_typing', {
        chatSessionId: data.chatSessionId,
        userId,
      });
    });

    socket.on('typing_stop', (data: { chatSessionId: string }) => {
      socket.to(`chat:${data.chatSessionId}`).emit('user_stopped_typing', {
        chatSessionId: data.chatSessionId,
        userId,
      });
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      this.handleDisconnect(socket, userId);
    });
  }

  /**
   * Handle socket disconnect
   */
  private handleDisconnect(socket: AuthSocket, userId: string) {
    logger.info(`User disconnected: ${userId} (${socket.id})`);

    // Remove socket from user's sockets
    const userSocketSet = this.userSockets.get(userId);
    if (userSocketSet) {
      userSocketSet.delete(socket.id);

      // If no more sockets for this user, broadcast offline
      if (userSocketSet.size === 0) {
        this.userSockets.delete(userId);
        this.broadcastUserStatus(userId, false);
      }
    }
  }

  /**
   * Broadcast user online status
   */
  private broadcastUserStatus(userId: string, isOnline: boolean) {
    this.io?.emit('user_status_changed', {
      userId,
      isOnline,
    });
  }

  /**
   * Send notification to other chat participants
   */
  private async sendNotificationToOthers(
    chatSessionId: string,
    senderId: string,
    message: any
  ) {
    try {
      const session = await chatService.getChatSession(chatSessionId, senderId);

      for (const participant of session.participants) {
        if (participant.id !== senderId) {
          await notificationService.sendMessageNotification(
            participant.id,
            session.name || 'Unknown',
            message.text,
            chatSessionId
          );

          // Send real-time notification
          this.io?.to(`user:${participant.id}`).emit('new_notification', {
            type: 'message',
            title: '新消息',
            message: `${session.name || 'Unknown'}: ${message.text.substring(0, 50)}`,
            data: {
              chatSessionId,
              messageId: message.id,
            },
          });
        }
      }
    } catch (error: any) {
      logger.error('Send notification error:', error);
    }
  }

  /**
   * Send message to specific user
   */
  sendToUser(userId: string, event: string, data: any) {
    this.io?.to(`user:${userId}`).emit(event, data);
  }

  /**
   * Send message to chat room
   */
  sendToChat(chatSessionId: string, event: string, data: any) {
    this.io?.to(`chat:${chatSessionId}`).emit(event, data);
  }

  /**
   * Broadcast to all connected clients
   */
  broadcast(event: string, data: any) {
    this.io?.emit(event, data);
  }

  /**
   * Get connected users count
   */
  getConnectedUsersCount(): number {
    return this.userSockets.size;
  }

  /**
   * Check if user is online
   */
  isUserOnline(userId: string): boolean {
    return this.userSockets.has(userId) && this.userSockets.get(userId)!.size > 0;
  }
}

export default new WebSocketService();
