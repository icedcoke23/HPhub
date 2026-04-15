import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { BadRequestError } from '../middleware/errorHandler';

const router = Router();

/**
 * 云变量存储（内存，实际应使用 Redis）
 */
const cloudVariables: Map<string, Map<string, any>> = new Map();

/**
 * GET /api/cloud - 获取用户的云变量
 */
router.get('/', authMiddleware.required, async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  
  const variables = cloudVariables.get(userId) || {};
  
  res.json({
    data: variables,
  });
});

/**
 * POST /api/cloud - 更新云变量
 */
router.post('/', authMiddleware.required, async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const { variables } = req.body;

  if (!variables || typeof variables !== 'object') {
    throw new BadRequestError('Invalid variables data');
  }

  // 验证云变量值
  for (const [key, value] of Object.entries(variables)) {
    if (typeof value === 'string' && value.length > 1024) {
      throw new BadRequestError(`Cloud variable "${key}" value too long (max 1024 characters)`);
    }
    if (typeof value === 'number' && (value < -1e15 || value > 1e15)) {
      throw new BadRequestError(`Cloud variable "${key}" value out of range`);
    }
  }

  // 合并变量
  const userVars = cloudVariables.get(userId) || new Map();
  for (const [key, value] of Object.entries(variables)) {
    userVars.set(key, value);
  }
  cloudVariables.set(userId, userVars);

  res.json({
    success: true,
    timestamp: new Date().toISOString(),
  });
});

/**
 * PUT /api/cloud/:projectId - 为特定项目更新云变量
 */
router.put('/:projectId', authMiddleware.required, async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const { projectId } = req.params;
  const { variables } = req.body;

  // 这里应该验证用户是否有权为此项目设置云变量
  
  res.json({
    success: true,
    projectId,
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/cloud/:projectId/leaderboard - 获取项目排行榜
 * 
 * 用于竞赛场景，读取特定云变量作为分数
 */
router.get('/:projectId/leaderboard', async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const { variable = 'score', limit = '100' } = req.query;
  
  const limitNum = parseInt(limit as string, 10);
  
  // 收集所有用户的该变量值
  const leaderboard: Array<{ userId: string; value: any; timestamp?: Date }> = [];
  
  for (const [userId, vars] of cloudVariables.entries()) {
    const value = vars.get(variable as string);
    if (value !== undefined) {
      leaderboard.push({
        userId,
        value,
      });
    }
  }
  
  // 排序（假设数值越大排名越高）
  leaderboard.sort((a, b) => {
    if (typeof a.value === 'number' && typeof b.value === 'number') {
      return b.value - a.value;
    }
    return String(b.value).localeCompare(String(a.value));
  });
  
  // 返回前 N 名
  res.json({
    data: leaderboard.slice(0, limitNum),
    variable,
    total: leaderboard.length,
  });
});

export { router as cloudRoutes };
