import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server } from 'http';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import logger from '../utils/logger';
import { TokenPayload } from '../types';
import chatService from './chat.service';
import messageService from './message.service';
import notificationService from './notification.service';
import prisma from '../config/database';
import { ErrorCode } from '../constants/errorCodes';

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
      // 弱网优化配置
      pingTimeout: 10000, // 10 秒超时（默认 5000）
      pingInterval: 15000, // 15 秒心跳（默认 25000）
      connectTimeout: 10000, // 10 秒连接超时（默认 10000）
      transports: ['websocket', 'polling'], // 允许降级到 polling
      allowUpgrades: true, // 允许从 polling 升级到 websocket
      perMessageDeflate: {
        threshold: 1024, // 小于 1KB 不压缩
        level: 6, // 压缩级别
      },
      httpCompression: {
        threshold: 1024,
      },
    });

    this.io.use(async (socket: AuthSocket, next) => {
      try {
        const token = socket.handshake.auth.token;
        logger.info(`[WebSocket] Auth attempt with token: ${token ? token.substring(0, 20) + '...' : 'none'}`);

        if (!token) {
          logger.warn('[WebSocket] No token provided');
          return next(new Error('Authentication required'));
        }

        const decoded = jwt.verify(token, config.jwt.secret) as TokenPayload;

        if (decoded.type !== 'access') {
          logger.warn('[WebSocket] Invalid token type');
          return next(new Error('Invalid token type'));
        }

        socket.userId = decoded.userId;
        socket.email = decoded.email;
        logger.info(`[WebSocket] Auth success for user: ${decoded.email} (${decoded.userId})`);

        next();
      } catch (error: any) {
        logger.error('[WebSocket] Authentication error:', error.message);
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
    logger.info(`User ${userId} joined user:${userId} room`);

    // Broadcast user online status
    this.broadcastUserStatus(userId, true);

    // Handle sending message
    socket.on('send_message', async (data: { targetId: string; text: string; type?: string; msgId?: string; chatType?: 'direct' | 'group' }) => {
      logger.info(`[WebSocket] Received send_message from ${userId}:`, JSON.stringify(data));

      try {
        const message = await messageService.sendMessage(
          data.targetId,
          userId,
          data.text,
          (data.type as any) || 'text',
          data.msgId,
          data.chatType || 'direct'
        );

        // 返回确认给发送者
        const messageSentData = {
          msgId: data.msgId,
          messageId: message.id,
          seq: message.seq,  // 返回 seq 供前端更新 lastAckedSeq
          status: 'sent',
        };
        logger.info(`[WebSocket] Emitting message_sent to ${userId}:`, JSON.stringify(messageSentData));
        socket.emit('message_sent', messageSentData);

        // Push to online receivers (using user:${userId} room)
        logger.info(`[WebSocket] start Pushing to online receivers directly`);
        await this._pushToOnlineReceivers(data.targetId, userId, message, data.chatType);
        logger.info(`[WebSocket] end Pushing to online receivers directly`);

        // Send notification to other participants
        await this.sendNotificationToOthers(data.targetId, userId, message);

        logger.info(`Message sent via WebSocket: ${message.id}`);
      } catch (error: any) {
        // 业务错误使用 info 级别，其他错误使用 error 级别
        const isBusinessError = error.code && [
          ErrorCode.GROUP_NOT_FOUND,
          ErrorCode.GROUP_DISSOLVED,
          ErrorCode.NOT_GROUP_MEMBER,
          ErrorCode.ACCESS_DENIED,
        ].includes(error.code);

        if (isBusinessError) {
          logger.info(`[WebSocket] Send message error: ${error.message}, code: ${error.code}`);
        } else {
          logger.error(`[WebSocket] Send message error:`, error.message);
        }
        socket.emit('error', {
          code: error.code || ErrorCode.INTERNAL_ERROR,
          message: error.message,
          msgId: data.msgId,
        });
      }
    });

    // Handle message read
    socket.on('mark_read', async (data: { chatSessionId: string; conversationId?: string; chatType?: 'direct' | 'group' }) => {
      try {
        await messageService.markMessagesAsRead(data.chatSessionId, userId);

        // Notify others in the chat using user room
        await this._pushToConversationParticipants(
          data.conversationId || data.chatSessionId,
          userId,
          'messages_read',
          {
            chatSessionId: data.chatSessionId,
            userId,
          },
          data.chatType
        );

        logger.info(`Messages marked as read via WebSocket: ${data.chatSessionId}`);
      } catch (error: any) {
        // 业务错误使用 info 级别
        const isBusinessError = error.code && [
          ErrorCode.GROUP_NOT_FOUND,
          ErrorCode.GROUP_DISSOLVED,
          ErrorCode.NOT_GROUP_MEMBER,
          ErrorCode.ACCESS_DENIED,
        ].includes(error.code);

        if (isBusinessError) {
          logger.info(`[WebSocket] Mark read error: ${error.message}, code: ${error.code}`);
        } else {
          logger.error(`[WebSocket] Mark read error:`, error.message);
        }
        socket.emit('error', {
          code: error.code || ErrorCode.INTERNAL_ERROR,
          message: error.message,
        });
      }
    });

    // Handle typing indicator
    socket.on('typing_start', (data: { chatSessionId: string; conversationId?: string; chatType?: 'direct' | 'group' }) => {
      this._pushToConversationParticipants(
        data.conversationId || data.chatSessionId,
        userId,
        'user_typing',
        {
          chatSessionId: data.chatSessionId,
          userId,
        },
        data.chatType
      );
    });

    socket.on('typing_stop', (data: { chatSessionId: string; conversationId?: string; chatType?: 'direct' | 'group' }) => {
      this._pushToConversationParticipants(
        data.conversationId || data.chatSessionId,
        userId,
        'user_stopped_typing',
        {
          chatSessionId: data.chatSessionId,
          userId,
        },
        data.chatType
      );
    });

    // Handle AI assistant request
    socket.on('assistant_request', async (data: { id: string; input: string; conversationId: string }) => {
      logger.info(`[WebSocket] Received assistant_request from ${userId}:`, JSON.stringify(data));

      try {
        // Import the OpenRouter service
        const openRouterService = (await import('./openrouter.service')).default;

        // Get context messages
        const messageService = (await import('./message.service')).default;
        const contextMessages = await messageService.getRecentMessagesForContext(userId, data.conversationId);

        // Stream the response back to the client
        await openRouterService.streamAnalyze(
          {
            input: data.input,
            contextMessages
          },
          {
            onStart: () => {
              socket.emit('assistant_response_chunk', {
                type: 'assistant_response_chunk',
                requestId: data.id,
                data: {
                  type: 'start'
                }
              });
            },
            onText: (text) => {
              socket.emit('assistant_response_chunk', {
                type: 'assistant_response_chunk',
                requestId: data.id,
                data: {
                  type: 'text',
                  content: text
                }
              });
            },
            onSuggestion: (text, highlight) => {
              socket.emit('assistant_response_chunk', {
                type: 'assistant_response_chunk',
                requestId: data.id,
                data: {
                  type: 'suggestion',
                  suggestion: {
                    text,
                    highlight
                  }
                }
              });
            },
            onDone: () => {
              socket.emit('assistant_response_chunk', {
                type: 'assistant_response_chunk',
                requestId: data.id,
                data: {
                  type: 'done'
                }
              });
            },
            onError: (error) => {
              socket.emit('assistant_response_chunk', {
                type: 'assistant_response_chunk',
                requestId: data.id,
                data: {
                  type: 'error',
                  error
                }
              });
            }
          }
        );
      } catch (error: any) {
        logger.error(`[WebSocket] Assistant request error:`, error.message);
        socket.emit('assistant_response_chunk', {
          type: 'assistant_response_chunk',
          requestId: data.id,
          data: {
            type: 'error',
            error: error.message
          }
        });
      }
    });

    // Handle message translate request
    socket.on('translate_message', async (data: { id: string; messageId: string; conversationId: string }) => {
      logger.info(`[WebSocket] ========== TRANSLATE MESSAGE REQUEST ==========`);
      logger.info(`[WebSocket] Received translate_message from ${userId}:`, JSON.stringify(data));

      try {
        // Import services
        const openRouterService = (await import('./openrouter.service')).default;
        const messageService = (await import('./message.service')).default;
        const prisma = (await import('../config/database')).default;

        logger.info(`[WebSocket] Fetching message to translate...`);

        // Get the message to translate using msgId
        const message = await prisma.message.findFirst({
          where: { msgId: data.messageId },
          select: {
            id: true,
            msgId: true,
            text: true,
            senderId: true,
            createdAt: true,
          },
        });

        if (!message) {
          logger.error(`[WebSocket] Message not found: ${data.messageId}`);
          socket.emit('translate_message_response', {
            type: 'translate_message_response',
            requestId: data.id,
            data: {
              type: 'error',
              error: 'Message not found'
            }
          });
          return;
        }

        logger.info(`[WebSocket] Message found:`, message.text.substring(0, 50));

        // Backend always translates - caching is handled on frontend

        // Get context messages (5 before, 2 after) using msgId
        logger.info(`[WebSocket] Fetching context messages using msgId: ${data.messageId}...`);
        const contextMessages = await messageService.getMessagesForTranslation(
          data.conversationId,
          data.messageId,  // This is msgId
          5, // before count
          2  // after count
        );

        logger.info(`[WebSocket] Context messages:`, {
          before: contextMessages.before.length,
          after: contextMessages.after.length
        });

        // Build translation prompt (English to Chinese)
        const translationInput = `Please translate the following English chat message to Chinese (简体中文). Keep the translation natural and conversational.

Context:
${contextMessages.before.map((m: any, i: number) => `${i + 1}. ${m.senderId === userId ? 'Me' : 'Other'}: ${m.text}`).join('\n')}

Current message to translate:
${message.text}

Directly output only the Chinese translation, no explanations.`;

        logger.info(`[WebSocket] Translation input:`, translationInput.substring(0, 500));

        // Stream translation from OpenRouter
        let fullTranslation = '';

        logger.info(`[WebSocket] Calling openRouterService.streamTranslate...`);

        await openRouterService.streamTranslate(
          translationInput,
          {
            onStart: () => {
              logger.info(`[WebSocket] Translation stream started`);
              socket.emit('translate_message_response', {
                type: 'translate_message_response',
                requestId: data.id,
                data: {
                  type: 'start'
                }
              });
            },
            onText: (text: string) => {
              logger.info(`[WebSocket] Translation chunk:`, text);
              fullTranslation += text;
              socket.emit('translate_message_response', {
                type: 'translate_message_response',
                requestId: data.id,
                data: {
                  type: 'chunk',
                  content: text
                }
              });
            },
            onDone: () => {
              // Translation completed - no need to save on backend
              // Frontend will handle caching
              logger.info(`[WebSocket] Translation completed:`, fullTranslation.substring(0, 50));
              socket.emit('translate_message_response', {
                type: 'translate_message_response',
                requestId: data.id,
                data: {
                  type: 'done',
                  messageId: data.messageId,
                  translation: fullTranslation
                }
              });
            },
            onError: (error: string) => {
              logger.error(`[WebSocket] Translation error:`, error);
              socket.emit('translate_message_response', {
                type: 'translate_message_response',
                requestId: data.id,
                data: {
                  type: 'error',
                  error
                }
              });
            }
          }
        );

        logger.info(`[WebSocket] streamTranslate completed`);
      } catch (error: any) {
        logger.error(`[WebSocket] Translate message error:`, error.message);
        logger.error(`[WebSocket] Error stack:`, error.stack);
        socket.emit('translate_message_response', {
          type: 'translate_message_response',
          requestId: data.id,
          data: {
            type: 'error',
            error: error.message
          }
        });
      }
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
      // 判断是私聊还是群聊
      // 私聊：chatSessionId 是 friendship.id（UUID 格式，包含 -）
      // 群聊：chatSessionId 是 ChatSession.id（cuid 格式，不包含 -）
      const isPrivateChat = chatSessionId.includes('-');

      // 私聊不发送通知，因为双方是好友，可以直接在消息页面看到
      // 群聊才需要发送通知
      // Note: chatService is deprecated, this code needs to be updated
      if (!isPrivateChat) {
        // const session = await chatService.getChatSession(chatSessionId, senderId);
        // Notification logic removed - chatService is deprecated
      }
    } catch (error: any) {
      logger.error('Send notification error:', error);
    }
  }

  /**
   * Push message to online receivers
   * 判断接收者是否在线，在线则实时推送到 user:${userId} 房间
   */
  private async _pushToOnlineReceivers(
    targetId: string,
    senderId: string,
    message: any,
    chatType?: 'direct' | 'group'
  ) {
    logger.info(`[WebSocket] _pushToOnlineReceivers called with targetId: ${targetId}, senderId: ${senderId}, chatType: ${chatType}`);

    try {
      // 判断是私聊还是群聊
      const isGroupChat = chatType === 'group' || targetId.startsWith('group_');
      logger.info(`[WebSocket] Chat type: ${isGroupChat ? 'group' : 'private'}`);

      if (!isGroupChat) {
        // 私聊：targetId 是 conversationId (格式：user1_user2)，需要提取接收者 ID
        const parts = targetId.split('_');
        let receiverId: string;

        if (parts.length === 2) {
          // conversationId 格式：user1_user2，接收者是不同于 senderId 的那个
          receiverId = parts[0] === senderId ? parts[1] : parts[0];
        } else {
          // 如果只有一个部分，targetId 本身就是接收者 ID
          receiverId = targetId;
        }

        logger.info(`[WebSocket] Private chat, calculated receiverId: ${receiverId}`);
        logger.info(`[WebSocket] userSockets has receiver: ${this.userSockets.has(receiverId)}, all online users: ${Array.from(this.userSockets.keys()).join(', ')}`);

        // 检查接收者是否在线
        if (this.userSockets.has(receiverId)) {
          logger.info(`[WebSocket] Pushing message to online user: ${receiverId}`);
          // 在线，推送消息到 user:${receiverId} 房间
          this.sendToUser(receiverId, 'receive_message', message);
        } else {
          logger.info(`[WebSocket] User ${receiverId} is offline, skip push`);
        }
      } else {
        // 群聊：targetId 是 groupId
        const groupId = targetId.replace('group_', '');
        const members = await prisma.groupMember.findMany({
          where: { groupId },
        });

        if (members) {
          for (const member of members) {
            if (member.userId !== senderId) {
              // 检查是否在线
              if (this.userSockets.has(member.userId)) {
                logger.info(`[WebSocket] Pushing message to online group member: ${member.userId}`);
                this.sendToUser(member.userId, 'receive_message', message);
              } else {
                logger.info(`[WebSocket] Group member ${member.userId} is offline, skip push`);
              }
            }
          }
        }
      }
    } catch (error: any) {
      logger.error('Push to online receivers error:', error.message);
    }
  }

  /**
   * Send message to specific user
   */
  sendToUser(userId: string, event: string, data: any) {
    this.io?.to(`user:${userId}`).emit(event, data);
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

  /**
   * Get other participant IDs in a conversation
   * Returns array of user IDs for the given conversation
   */
  private async _getOtherParticipantIds(
    targetId: string,
    senderId: string,
    chatType?: 'direct' | 'group'
  ): Promise<string[]> {
    const isGroupChat = chatType === 'group' || targetId.startsWith('group_');

    if (!isGroupChat) {
      // Direct chat: extract the other user ID from conversationId
      const parts = targetId.split('_');
      if (parts.length === 2) {
        const otherUserId = parts[0] === senderId ? parts[1] : parts[0];
        return [otherUserId];
      } else {
        // If targetId is already a user ID
        return [targetId];
      }
    } else {
      // Group chat: get all members except sender
      const groupId = targetId.replace('group_', '');
      const members = await prisma.groupMember.findMany({
        where: { groupId },
        select: { userId: true },
      });
      return members
        .map(m => m.userId)
        .filter(userId => userId !== senderId);
    }
  }

  /**
   * Push event to other participants in a conversation
   */
  private async _pushToConversationParticipants(
    targetId: string,
    senderId: string,
    event: string,
    data: any,
    chatType?: 'direct' | 'group'
  ) {
    const participantIds = await this._getOtherParticipantIds(targetId, senderId, chatType);

    for (const participantId of participantIds) {
      if (this.userSockets.has(participantId)) {
        this.sendToUser(participantId, event, data);
      }
    }
  }
}

export default new WebSocketService();
