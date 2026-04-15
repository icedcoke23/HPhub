import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';

// 路由
import { projectRoutes } from './routes/projects';
import { userRoutes } from './routes/users';
import { assetRoutes } from './routes/assets';
import { competitionRoutes } from './routes/competitions';
import { cloudRoutes } from './routes/cloud';

// 中间件
import { errorHandler } from './middleware/errorHandler';
import { authMiddleware } from './middleware/auth';

// 加载环境变量
dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 3001;

// ============================================
// 中间件配置
// ============================================

// 安全头部
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-eval'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:", "*"],
      connectSrc: ["'self'", "*"],
    },
  },
}));

// CORS 配置
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

// 压缩
app.use(compression());

// 日志
app.use(morgan('combined'));

// JSON 解析
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ============================================
// 健康检查
// ============================================
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ============================================
// API 路由
// ============================================

// 公开路由
app.use('/api/assets', assetRoutes);
app.use('/api/health', (req: Request, res: Response) => res.json({ status: 'ok' }));

// 需要认证的路由
app.use('/api/projects', authMiddleware.optional, projectRoutes);
app.use('/api/users', authMiddleware.required, userRoutes);
app.use('/api/cloud', authMiddleware.required, cloudRoutes);
app.use('/api/competitions', authMiddleware.optional, competitionRoutes);

// ============================================
// 错误处理
// ============================================

// 404
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.path}`,
  });
});

// 全局错误处理
app.use(errorHandler);

// ============================================
// 启动服务器
// ============================================

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════╗
║     Scratch Platform API Server            ║
╠════════════════════════════════════════════╣
║  Environment: ${process.env.NODE_ENV || 'development'}
║  Port: ${PORT}
║  Health: http://localhost:${PORT}/health
╚════════════════════════════════════════════╝
    `);
  });
}

export default app;
