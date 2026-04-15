import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authMiddleware } from '../middleware/auth';
import { BadRequestError, NotFoundError, ForbiddenError } from '../middleware/errorHandler';

const router = Router();

/**
 * 竞赛数据结构
 */
interface Competition {
  id: string;
  title: string;
  description: string;
  rules: string;
  startTime: Date;
  endTime: Date;
  status: 'draft' | 'active' | 'ended';
  maxSubmissionsPerUser: number;
  allowedExtensions?: string[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 提交记录
 */
interface Submission {
  id: string;
  competitionId: string;
  userId: string;
  projectId: string;
  score?: number;
  judgedAt?: Date;
  status: 'pending' | 'judged' | 'disqualified';
  submittedAt: Date;
}

// 内存存储（实际应使用数据库）
const competitions: Map<string, Competition> = new Map();
const submissions: Map<string, Submission> = new Map();

/**
 * GET /api/competitions - 获取竞赛列表
 */
router.get('/', async (req: Request, res: Response) => {
  const { status } = req.query;
  
  let filteredCompetitions = Array.from(competitions.values());
  
  if (status) {
    filteredCompetitions = filteredCompetitions.filter(c => c.status === status);
  }
  
  // 只返回公开信息
  const publicCompetitions = filteredCompetitions.map(c => ({
    id: c.id,
    title: c.title,
    description: c.description,
    startTime: c.startTime,
    endTime: c.endTime,
    status: c.status,
  }));
  
  res.json({
    data: publicCompetitions,
  });
});

/**
 * POST /api/competitions - 创建竞赛（需要管理员权限）
 */
router.post('/', authMiddleware.required, async (req: Request, res: Response) => {
  // 这里应该检查管理员权限
  
  const { 
    title, 
    description = '', 
    rules = '',
    startTime, 
    endTime,
    maxSubmissionsPerUser = 3,
    allowedExtensions 
  } = req.body;

  if (!title || !startTime || !endTime) {
    throw new BadRequestError('Title, startTime, and endTime are required');
  }

  const competition: Competition = {
    id: uuidv4(),
    title,
    description,
    rules,
    startTime: new Date(startTime),
    endTime: new Date(endTime),
    status: 'draft',
    maxSubmissionsPerUser,
    allowedExtensions,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  competitions.set(competition.id, competition);

  res.status(201).json({
    data: competition,
  });
});

/**
 * GET /api/competitions/:id - 获取竞赛详情
 */
router.get('/:id', async (req: Request, res: Response) => {
  const competition = competitions.get(req.params.id);

  if (!competition) {
    throw new NotFoundError('Competition not found');
  }

  res.json({
    data: competition,
  });
});

/**
 * POST /api/competitions/:id/submit - 提交作品到竞赛
 */
router.post('/:id/submit', authMiddleware.required, async (req: Request, res: Response) => {
  const competition = competitions.get(req.params.id);

  if (!competition) {
    throw new NotFoundError('Competition not found');
  }

  // 检查竞赛状态
  const now = new Date();
  if (competition.status !== 'active') {
    throw new BadRequestError('Competition is not active');
  }
  if (now < competition.startTime) {
    throw new BadRequestError('Competition has not started yet');
  }
  if (now > competition.endTime) {
    throw new BadRequestError('Competition has ended');
  }

  const { projectId } = req.body;

  if (!projectId) {
    throw new BadRequestError('Project ID is required');
  }

  // 检查用户提交次数
  const userSubmissions = Array.from(submissions.values()).filter(
    s => s.competitionId === competition.id && s.userId === req.user!.userId
  );

  if (userSubmissions.length >= competition.maxSubmissionsPerUser) {
    throw new BadRequestError(`Maximum ${competition.maxSubmissionsPerUser} submissions allowed`);
  }

  // 创建提交记录
  const submission: Submission = {
    id: uuidv4(),
    competitionId: competition.id,
    userId: req.user!.userId,
    projectId,
    status: 'pending',
    submittedAt: new Date(),
  };

  submissions.set(submission.id, submission);

  // 触发自动评测（异步）
  // await triggerAutoJudge(submission);

  res.status(201).json({
    data: submission,
    message: 'Submission received. Judging in progress...',
  });
});

/**
 * GET /api/competitions/:id/leaderboard - 获取竞赛排行榜
 */
router.get('/:id/leaderboard', async (req: Request, res: Response) => {
  const competition = competitions.get(req.params.id);

  if (!competition) {
    throw new NotFoundError('Competition not found');
  }

  // 获取所有已评审的提交
  const judgedSubmissions = Array.from(submissions.values())
    .filter(s => s.competitionId === competition.id && s.status === 'judged')
    .sort((a, b) => (b.score || 0) - (a.score || 0));

  res.json({
    data: judgedSubmissions.map(s => ({
      rank: 0, // 会在前端计算
      userId: s.userId,
      projectId: s.projectId,
      score: s.score,
      submittedAt: s.submittedAt,
    })),
  });
});

/**
 * POST /api/competitions/:id/judge - 触发自动评测（管理员）
 */
router.post('/:id/judge', authMiddleware.required, async (req: Request, res: Response) => {
  // 这里应该检查管理员权限
  
  const competition = competitions.get(req.params.id);

  if (!competition) {
    throw new NotFoundError('Competition not found');
  }

  // 获取所有待评审的提交
  const pendingSubmissions = Array.from(submissions.values())
    .filter(s => s.competitionId === competition.id && s.status === 'pending');

  // 触发批量评测
  // for (const submission of pendingSubmissions) {
  //   await judgeSubmission(submission, competition);
  // }

  res.json({
    message: `Triggered judging for ${pendingSubmissions.length} submissions`,
    count: pendingSubmissions.length,
  });
});

export { router as competitionRoutes };
