import { Request, Response, NextFunction } from 'express';

/**
 * API 错误类
 */
export class ApiError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 400 Bad Request
 */
export class BadRequestError extends ApiError {
  constructor(message: string = 'Bad Request') {
    super(message, 400);
  }
}

/**
 * 401 Unauthorized
 */
export class UnauthorizedError extends ApiError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401);
  }
}

/**
 * 403 Forbidden
 */
export class ForbiddenError extends ApiError {
  constructor(message: string = 'Forbidden') {
    super(message, 403);
  }
}

/**
 * 404 Not Found
 */
export class NotFoundError extends ApiError {
  constructor(message: string = 'Not Found') {
    super(message, 404);
  }
}

/**
 * 500 Internal Server Error
 */
export class InternalError extends ApiError {
  constructor(message: string = 'Internal Server Error') {
    super(message, 500, false);
  }
}

/**
 * 全局错误处理中间件
 */
export const errorHandler = (
  err: Error | ApiError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // 默认错误
  let statusCode = 500;
  let message = 'Internal Server Error';
  let isOperational = true;

  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
    isOperational = err.isOperational;
  } else if (err instanceof Error) {
    message = err.message;
    isOperational = false;
  }

  // 记录错误日志
  console.error(`[Error] ${statusCode} - ${message}`, {
    path: req.path,
    method: req.method,
    stack: err.stack,
  });

  // 返回错误响应
  res.status(statusCode).json({
    error: {
      code: statusCode,
      message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    },
  });

  // 如果是非操作性错误，考虑重启进程
  if (!isOperational && process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
};
