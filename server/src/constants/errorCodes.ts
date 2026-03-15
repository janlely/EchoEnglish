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

export const ErrorMessage: Record<ErrorCode, string> = {
  [ErrorCode.GROUP_NOT_FOUND]: '群不存在',
  [ErrorCode.GROUP_DISSOLVED]: '本群已解散',
  [ErrorCode.NOT_GROUP_MEMBER]: '您不是群成员',
  [ErrorCode.ACCESS_DENIED]: '无权限访问',
  [ErrorCode.FRIEND_NOT_FOUND]: '好友关系不存在',
  [ErrorCode.INVALID_REQUEST]: '请求参数无效',
  [ErrorCode.INTERNAL_ERROR]: '服务器内部错误',
  [ErrorCode.AUTHENTICATION_FAILED]: '认证失败',
};

/**
 * 创建带有错误码的 Error
 */
export function createError(code: ErrorCode, message?: string): Error {
  const error = new Error(message || ErrorMessage[code]) as any;
  error.code = code;
  return error;
}