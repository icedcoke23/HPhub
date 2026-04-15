import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UnauthorizedError, ForbiddenError } from '../middleware/errorHandler';

/**
 * JWT Payload 接口
 */
export interface JWTPayload {
  userId: string;
  email: string;
  role?: string;
  iat?: number;
  exp?: number;
}

/**
 * 扩展 Express Request 类型
 */
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-me';

/**
 * 验证 JWT Token
 */
function verifyToken(token: string): JWTPayload {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (error) {
    throw new UnauthorizedError('Invalid or expired token');
  }
}

/**
 * 提取 Bearer Token
 */
function extractBearerToken(authHeader?: string): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

/**
 * 认证中间件 - 可选
 * 如果提供了 token 则验证，否则继续（用户可能未登录）
 */
const optional = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const token = extractBearerToken(req.headers.authorization);
    
    if (token) {
      req.user = verifyToken(token);
    }
    
    next();
  } catch (error) {
    // Token 无效时不阻止请求，只是不清除 user
    next();
  }
};

/**
 * 认证中间件 - 必需
 * 必须有有效的 token 才能访问
 */
const required = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const token = extractBearerToken(req.headers.authorization);
    
    if (!token) {
      throw new UnauthorizedError('Authentication required');
    }
    
    req.user = verifyToken(token);
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * 角色检查中间件
 */
const requireRole = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }
    
    if (!req.user.role || !roles.includes(req.user.role)) {
      throw new ForbiddenError('Insufficient permissions');
    }
    
    next();
  };
};

/**
 * 生成 JWT Token
 */
export function generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>, expiresIn: string = '7d'): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

/**
 * 认证中间件导出
 */
export const authMiddleware = {
  optional,
  required,
  requireRole,
};
