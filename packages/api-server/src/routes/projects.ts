import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import { authMiddleware } from '../middleware/auth';
import { BadRequestError, NotFoundError, ForbiddenError } from '../middleware/errorHandler';

const router = Router();

// 配置 multer 用于文件上传
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/x.scratch.sb3' || file.originalname.endsWith('.sb3')) {
      cb(null, true);
    } else {
      cb(new BadRequestError('Only .sb3 files are allowed'));
    }
  },
});

/**
 * 项目数据结构
 */
interface Project {
  id: string;
  userId: string;
  title: string;
  description: string;
  visibility: 'private' | 'public' | 'unlisted';
  sb3Key: string;
  thumbnailKey?: string;
  cloudVariables: Record<string, any>;
  competitionId?: string;
  classroomId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// 内存存储（实际应使用数据库）
const projects: Map<string, Project> = new Map();

/**
 * GET /api/projects - 获取项目列表
 */
router.get('/', authMiddleware.optional, async (req: Request, res: Response) => {
  const { 
    page = '1', 
    limit = '20', 
    visibility = 'public',
    userId,
    search 
  } = req.query;

  const pageNum = parseInt(page as string, 10);
  const limitNum = parseInt(limit as string, 10);
  const offset = (pageNum - 1) * limitNum;

  let filteredProjects = Array.from(projects.values());

  // 过滤条件
  if (visibility) {
    filteredProjects = filteredProjects.filter(p => p.visibility === visibility);
  }

  if (userId) {
    filteredProjects = filteredProjects.filter(p => p.userId === userId);
  }

  if (search) {
    const searchTerm = (search as string).toLowerCase();
    filteredProjects = filteredProjects.filter(p => 
      p.title.toLowerCase().includes(searchTerm) ||
      p.description.toLowerCase().includes(searchTerm)
    );
  }

  // 分页
  const total = filteredProjects.length;
  const paginatedProjects = filteredProjects.slice(offset, offset + limitNum);

  res.json({
    data: paginatedProjects.map(projectToPublic),
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  });
});

/**
 * POST /api/projects - 创建新项目
 */
router.post('/', authMiddleware.required, upload.single('project'), async (req: Request, res: Response) => {
  const { title = 'Untitled Project', description = '', visibility = 'private' } = req.body;

  // 验证 SB3 文件
  if (!req.file) {
    throw new BadRequestError('Project file (.sb3) is required');
  }

  // 这里应该将文件上传到 S3
  const sb3Key = `projects/${req.user!.userId}/${uuidv4()}.sb3`;

  const project: Project = {
    id: uuidv4(),
    userId: req.user!.userId,
    title,
    description,
    visibility: visibility as 'private' | 'public' | 'unlisted',
    sb3Key,
    cloudVariables: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  projects.set(project.id, project);

  res.status(201).json({
    data: projectToPublic(project),
  });
});

/**
 * GET /api/projects/:id - 获取单个项目
 */
router.get('/:id', authMiddleware.optional, async (req: Request, res: Response) => {
  const project = projects.get(req.params.id);

  if (!project) {
    throw new NotFoundError('Project not found');
  }

  // 检查权限
  if (project.visibility === 'private' && project.userId !== req.user?.userId) {
    throw new ForbiddenError('You do not have access to this project');
  }

  res.json({
    data: projectToPublic(project),
  });
});

/**
 * PUT /api/projects/:id - 更新项目
 */
router.put('/:id', authMiddleware.required, async (req: Request, res: Response) => {
  const project = projects.get(req.params.id);

  if (!project) {
    throw new NotFoundError('Project not found');
  }

  // 检查所有权
  if (project.userId !== req.user!.userId) {
    throw new ForbiddenError('You do not own this project');
  }

  const { title, description, visibility } = req.body;

  project.title = title ?? project.title;
  project.description = description ?? project.description;
  project.visibility = (visibility as 'private' | 'public' | 'unlisted') ?? project.visibility;
  project.updatedAt = new Date();

  projects.set(project.id, project);

  res.json({
    data: projectToPublic(project),
  });
});

/**
 * DELETE /api/projects/:id - 删除项目
 */
router.delete('/:id', authMiddleware.required, async (req: Request, res: Response) => {
  const project = projects.get(req.params.id);

  if (!project) {
    throw new NotFoundError('Project not found');
  }

  // 检查所有权
  if (project.userId !== req.user!.userId) {
    throw new ForbiddenError('You do not own this project');
  }

  projects.delete(project.id);

  res.status(204).send();
});

/**
 * GET /api/projects/:id/sb3 - 获取项目 SB3 文件
 */
router.get('/:id/sb3', authMiddleware.optional, async (req: Request, res: Response) => {
  const project = projects.get(req.params.id);

  if (!project) {
    throw new NotFoundError('Project not found');
  }

  // 检查权限
  if (project.visibility === 'private' && project.userId !== req.user?.userId) {
    throw new ForbiddenError('You do not have access to this project');
  }

  // 这里应该从 S3 获取文件并返回
  res.setHeader('Content-Type', 'application/x.scratch.sb3');
  res.setHeader('Content-Disposition', `attachment; filename="${project.title}.sb3"`);
  
  // 模拟返回空文件
  res.send(Buffer.from([]));
});

/**
 * POST /api/projects/:id/duplicate - 复制项目
 */
router.post('/:id/duplicate', authMiddleware.required, async (req: Request, res: Response) => {
  const originalProject = projects.get(req.params.id);

  if (!originalProject) {
    throw new NotFoundError('Project not found');
  }

  // 检查权限
  if (originalProject.visibility === 'private' && originalProject.userId !== req.user!.userId) {
    throw new ForbiddenError('You do not have access to this project');
  }

  const newProject: Project = {
    ...originalProject,
    id: uuidv4(),
    userId: req.user!.userId,
    title: `${originalProject.title} (Copy)`,
    visibility: 'private',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  projects.set(newProject.id, newProject);

  res.status(201).json({
    data: projectToPublic(newProject),
  });
});

/**
 * 将项目转换为公开数据（移除敏感信息）
 */
function projectToPublic(project: Project) {
  const { userId, sb3Key, thumbnailKey, ...publicData } = project;
  return {
    ...publicData,
    _owner: userId,
  };
}

export { router as projectRoutes };
