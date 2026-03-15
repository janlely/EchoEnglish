/**
 * 错误码定义
 * 用于前后端统一的错误处理
 */

export enum ErrorCode {
  // 群相关错误
  GROUP_NOT_FOUND = 'GROUP_NOT_FOUND',           // 群不存在
  GROUP_DISSOLVED = 'GROUP_DISSOLVED',           // 群已解散
  NOT_GROUP_MEMBER = 'NOT_GROUP_MEMBER',         // 不是群成员

  // 权限错误
  ACCESS_DENIED = 'ACCESS_DENIED',               // 无权限访问

  // 好友相关错误
  FRIEND_NOT_FOUND = 'FRIEND_NOT_FOUND',         // 好友关系不存在

  // 通用错误
  INVALID_REQUEST = 'INVALID_REQUEST',           // 无效请求
  INTERNAL_ERROR = 'INTERNAL_ERROR',             // 内部错误
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED', // 认证失败
}

/**
 * 群解散相关错误码集合
 * 当用户收到这些错误码时，表示群已解散或用户已被移出群
 */
export const GROUP_DISSOLVED_ERROR_CODES: ErrorCode[] = [
  ErrorCode.GROUP_DISSOLVED,
  ErrorCode.GROUP_NOT_FOUND,
  ErrorCode.NOT_GROUP_MEMBER,
];

/**
 * 判断是否为群解散相关错误
 * @param code 错误码
 * @returns 是否为群解散相关错误
 */
export function isGroupDissolvedError(code: ErrorCode | string | undefined): boolean {
  if (!code) return false;
  return GROUP_DISSOLVED_ERROR_CODES.includes(code as ErrorCode);
}