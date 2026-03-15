/**
 * 全局事件总线
 * 用于跨组件、跨模块通信
 */

import logger from '../utils/logger';

// 定义所有事件类型
export interface EventMap {
  // WebSocket 消息事件
  'ws:message': WebSocketMessageData;
  'ws:message_sent': WebSocketMessageSentData;
  'ws:send_error': WebSocketError;
  'ws:user_status': WebSocketUserStatusData;
  'ws:typing': WebSocketTypingData;
  'ws:messages_read': WebSocketMessagesReadData;
  'ws:notification': WebSocketNotificationData;
  'ws:assistant_chunk': any;
  'ws:translate_response': any;

  // 业务事件
  'group:dissolved': { groupId: string };
  'conversation:updated': { conversationId: string };
}

// 事件数据类型定义
export interface WebSocketMessageSentData {
  msgId?: string;
  messageId?: string;
  seq?: number;
  status?: string;
  senderId?: string;
}

export interface WebSocketMessageData {
  msgId?: string;
  messageId?: string;
  text?: string;
  senderId?: string;
  conversationId?: string;
  chatType?: string;
  status?: string;
  createdAt?: string | Date;
  [key: string]: any;
}

export interface WebSocketError {
  code: string;
  message: string;
  msgId?: string;
}

export interface WebSocketUserStatusData {
  userId: string;
  isOnline: boolean;
}

export interface WebSocketTypingData {
  chatSessionId: string;
  userId: string;
}

export interface WebSocketMessagesReadData {
  chatSessionId: string;
  userId: string;
}

export interface WebSocketNotificationData {
  id: string;
  type: string;
  title: string;
  body: string;
  [key: string]: any;
}

type EventHandler<T = any> = (data: T) => void;

/**
 * 事件总线类
 */
class EventBusClass {
  private handlers: Map<keyof EventMap, Set<EventHandler>> = new Map();
  private onceHandlers: Map<keyof EventMap, Set<EventHandler>> = new Map();

  /**
   * 订阅事件
   * @param event 事件名称
   * @param handler 事件处理器
   * @returns 取消订阅函数
   */
  on<K extends keyof EventMap>(event: K, handler: EventHandler<EventMap[K]>): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);

    logger.debug('EventBus', `📌 Subscribed to '${event}', total handlers: ${this.handlers.get(event)!.size}`);

    // 返回取消订阅函数
    return () => this.off(event, handler);
  }

  /**
   * 订阅一次性事件
   * @param event 事件名称
   * @param handler 事件处理器
   * @returns 取消订阅函数
   */
  once<K extends keyof EventMap>(event: K, handler: EventHandler<EventMap[K]>): () => void {
    if (!this.onceHandlers.has(event)) {
      this.onceHandlers.set(event, new Set());
    }
    this.onceHandlers.get(event)!.add(handler);

    logger.debug('EventBus', `📌 Subscribed once to '${event}'`);

    return () => {
      this.onceHandlers.get(event)?.delete(handler);
    };
  }

  /**
   * 取消订阅事件
   * @param event 事件名称
   * @param handler 事件处理器
   */
  off<K extends keyof EventMap>(event: K, handler: EventHandler<EventMap[K]>): void {
    this.handlers.get(event)?.delete(handler);
    this.onceHandlers.get(event)?.delete(handler);

    const size = this.handlers.get(event)?.size ?? 0;
    logger.debug('EventBus', `🗑️ Unsubscribed from '${event}', remaining handlers: ${size}`);
  }

  /**
   * 广播事件
   * @param event 事件名称
   * @param data 事件数据
   */
  emit<K extends keyof EventMap>(event: K, data: EventMap[K]): void {
    const handlers = this.handlers.get(event);
    const onceHandlers = this.onceHandlers.get(event);

    const totalListeners = (handlers?.size ?? 0) + (onceHandlers?.size ?? 0);
    logger.info('EventBus', `🚀 Emitting '${event}' to ${totalListeners} listener(s)`, data);

    // 调用持久订阅者
    handlers?.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        logger.error('EventBus', `Error in handler for '${event}':`, error);
      }
    });

    // 调用一次性订阅者
    if (onceHandlers && onceHandlers.size > 0) {
      const handlersToCall = Array.from(onceHandlers);
      onceHandlers.clear(); // 先清空，防止处理器中再次订阅
      handlersToCall.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          logger.error('EventBus', `Error in once handler for '${event}':`, error);
        }
      });
    }
  }

  /**
   * 清除指定事件的所有订阅者
   */
  clear(event: keyof EventMap): void {
    this.handlers.get(event)?.clear();
    this.onceHandlers.get(event)?.clear();
    logger.info('EventBus', `🧹 Cleared all handlers for '${event}'`);
  }

  /**
   * 清除所有订阅者
   */
  clearAll(): void {
    this.handlers.clear();
    this.onceHandlers.clear();
    logger.info('EventBus', '🧹 Cleared all handlers');
  }

  /**
   * 获取指定事件的订阅者数量
   */
  listenerCount(event: keyof EventMap): number {
    return (this.handlers.get(event)?.size ?? 0) + (this.onceHandlers.get(event)?.size ?? 0);
  }
}

// 导出全局单例
export const EventBus = new EventBusClass();

// 导出便捷方法
export const onEvent = EventBus.on.bind(EventBus);
export const onceEvent = EventBus.once.bind(EventBus);
export const offEvent = EventBus.off.bind(EventBus);
export const emitEvent = EventBus.emit.bind(EventBus);