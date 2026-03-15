/**
 * 事件模块导出
 */

export {
  EventBus,
  onEvent,
  onceEvent,
  offEvent,
  emitEvent,
} from './EventBus';

export type {
  EventMap,
  WebSocketMessageData,
  WebSocketError,
  WebSocketUserStatusData,
  WebSocketTypingData,
  WebSocketMessagesReadData,
  WebSocketNotificationData,
} from './EventBus';