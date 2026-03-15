import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';
import { ApiResponse } from '../types';

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;
  code?: string; // Error code

  constructor(message: string, statusCode: number, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.code = code;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorMiddleware = (
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const statusCode = (err as AppError).statusCode || 500;
  const message = err.message || 'Internal server error';
  const code = (err as any).code; // Get error code if present

  // 业务错误使用 info 级别，其他错误使用 error 级别
  if (code || message === '本群已解散' || message === '群不存在' || message === '您不是群成员') {
    logger.info(`Error: ${message}`, {
      statusCode,
      code,
      path: req.path,
      method: req.method,
    });
  } else {
    logger.error(`Error: ${message}`, {
      statusCode,
      code,
      path: req.path,
      method: req.method,
      stack: err.stack,
    });
  }

  const response: ApiResponse = {
    success: false,
    error: message,
  };

  // Include error code if present
  if (code) {
    (response as any).code = code;
  }

  if (process.env.NODE_ENV === 'development') {
    (response as any).stack = err.stack;
  }

  res.status(statusCode).json(response);
};

export const notFoundMiddleware = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const error = new AppError(`Not Found - ${req.originalUrl}`, 404);
  next(error);
};
