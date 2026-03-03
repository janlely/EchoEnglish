/**
 * ChatDetailScreen 工具函数
 */

/**
 * 生成消息 ID（时间戳 + 随机数）
 * @returns 消息 ID，格式: msg_m4k7j2x8n3p9
 */
export const generateMsgId = (): string => {
  const timestamp = Date.now().toString(36); // 36 进制时间戳
  const random = Math.random().toString(36).substring(2, 8); // 6 位随机数
  return `msg_${timestamp}_${random}`;
};

/**
 * 格式化时间戳为时间字符串
 * @param timestamp 时间戳（毫秒）
 * @returns 格式化后的时间字符串，如 "14:30"
 */
export const formatTimestamp = (timestamp: number): string => {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

/**
 * 消息发送超时时间（毫秒）
 */
export const SENDING_TIMEOUT = 10000;