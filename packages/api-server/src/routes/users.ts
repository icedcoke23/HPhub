import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { authMiddleware, generateToken } from '../middleware/auth';
import { BadRequestError, UnauthorizedError } from '../middleware/errorHandler';

const router = Router();

/**
 * 用户数据结构
 */
interface User {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  role: 'user' | 'teacher' | 'admin';
  createdAt: Date;
  lastLoginAt?: Date;
}

// 内存存储（实际应使用数据库）
const users: Map<string, User> = new Map();

/**
 * POST /api/users/register - 用户注册
 */
router.post('/register', async (req: Request, res: Response) => {
  const { email, username, password } = req.body;

  // 验证输入
  if (!email || !username || !password) {
    throw new BadRequestError('Email, username, and password are required');
  }

  if (password.length < 6) {
    throw new BadRequestError('Password must be at least 6 characters');
  }

  // 检查邮箱是否已存在
  const existingUser = Array.from(users.values()).find(u => u.email === email);
  if (existingUser) {
    throw new BadRequestError('Email already registered');
  }

  // 哈希密码
  const passwordHash = await bcrypt.hash(password, 10);

  // 创建用户
  const user: User = {
    id: uuidv4(),
    email,
    username,
    passwordHash,
    role: 'user',
    createdAt: new Date(),
  };

  users.set(user.id, user);

  // 生成 Token
  const token = generateToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  res.status(201).json({
    data: {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    },
    token,
  });
});

/**
 * POST /api/users/login - 用户登录
 */
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new BadRequestError('Email and password are required');
  }

  // 查找用户
  const user = Array.from(users.values()).find(u => u.email === email);
  if (!user) {
    throw new UnauthorizedError('Invalid credentials');
  }

  // 验证密码
  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    throw new UnauthorizedError('Invalid credentials');
  }

  // 更新最后登录时间
  user.lastLoginAt = new Date();
  users.set(user.id, user);

  // 生成 Token
  const token = generateToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  res.json({
    data: {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    },
    token,
  });
});

/**
 * GET /api/users/me - 获取当前用户信息
 */
router.get('/me', authMiddleware.required, async (req: Request, res: Response) => {
  const user = users.get(req.user!.userId);

  if (!user) {
    throw new UnauthorizedError('User not found');
  }

  res.json({
    data: {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    },
  });
});

/**
 * PUT /api/users/me - 更新当前用户信息
 */
router.put('/me', authMiddleware.required, async (req: Request, res: Response) => {
  const user = users.get(req.user!.userId);

  if (!user) {
    throw new UnauthorizedError('User not found');
  }

  const { username } = req.body;

  if (username) {
    user.username = username;
    user.updatedAt = new Date();
  }

  users.set(user.id, user);

  res.json({
    data: {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    },
  });
});

/**
 * PUT /api/users/me/password - 修改密码
 */
router.put('/me/password', authMiddleware.required, async (req: Request, res: Response) => {
  const user = users.get(req.user!.userId);

  if (!user) {
    throw new UnauthorizedError('User not found');
  }

  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    throw new BadRequestError('Current password and new password are required');
  }

  if (newPassword.length < 6) {
    throw new BadRequestError('New password must be at least 6 characters');
  }

  // 验证当前密码
  const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isValid) {
    throw new UnauthorizedError('Current password is incorrect');
  }

  // 更新密码
  user.passwordHash = await bcrypt.hash(newPassword, 10);
  users.set(user.id, user);

  res.json({
    message: 'Password updated successfully',
  });
});

export { router as userRoutes };
