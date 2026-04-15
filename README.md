# 面向社区的在线 Scratch 编译器集成方案

> 基于 TurboWarp 引擎，支持多用户独立使用，预留竞赛/社区/课堂扩展能力

## 📐 项目架构

```
scratch-platform/
├── packages/
│   ├── tw-engine/          # TurboWarp 引擎封装包 (核心)
│   │   ├── src/
│   │   │   ├── TWEngine.ts      # 核心引擎类
│   │   │   ├── types.ts         # 类型定义
│   │   │   ├── components/      # React 组件
│   │   │   │   ├── TWEditor.tsx # 编辑器组件
│   │   │   │   └── TWPlayer.tsx # 播放器组件
│   │   │   └── plugins/         # 插件系统
│   │   └── package.json
│   │
│   ├── api-server/         # API 服务器
│   │   ├── src/
│   │   │   ├── index.ts         # 入口文件
│   │   │   ├── routes/          # API 路由
│   │   │   │   ├── projects.ts  # 项目 CRUD
│   │   │   │   ├── users.ts     # 用户认证
│   │   │   │   ├── assets.ts    # 资源代理
│   │   │   │   ├── cloud.ts     # 云变量
│   │   │   │   └── competitions.ts # 竞赛
│   │   │   └── middleware/      # 中间件
│   │   └── package.json
│   │
│   └── worker/             # 后台工作器
│       ├── src/
│       │   ├── index.ts           # 入口文件
│       │   └── headless-runner.ts # 无头评测
│       └── package.json
│
├── docker/
│   ├── docker-compose.yml  # Docker 编排
│   └── init.sql           # 数据库初始化
│
└── docs/                  # 文档
```

## 🚀 快速开始

### 前置要求

- Node.js >= 18.0.0
- npm >= 9.0.0
- Docker & Docker Compose (可选，用于完整部署)

### 安装依赖

```bash
# 安装根依赖
npm install

# 安装各包依赖
npm install --workspaces
```

### 开发模式

```bash
# 启动所有服务（需要 Docker）
npm run docker:up

# 开发模式运行
npm run dev
```

### 构建

```bash
# 构建所有包
npm run build
```

## 📦 核心模块

### @platform/tw-engine

TurboWarp 引擎封装包，提供：

- **TWEngine**: 核心引擎类，封装 scratch-vm
- **TWEditor**: React 编辑器组件
- **TWPlayer**: React 播放器组件
- **插件系统**: 支持性能监控、云同步、自动保存等插件

```typescript
import { TWEngine, TWEditor } from '@platform/tw-engine';

// 直接使用引擎
const engine = new TWEngine({ 
  enableCompiler: true,
  userId: 'user-123'
});
await engine.loadProject('/api/projects/xxx/sb3');
engine.start();

// 或使用 React 组件
<TWEditor projectId="xxx" onSave={handleSave} />
```

### @platform/api-server

RESTful API 服务器，提供：

- 用户认证（JWT）
- 项目 CRUD
- 资源代理（CDN 缓存）
- 云变量同步
- 竞赛管理

### @platform/worker

后台任务处理器：

- 无头编译评测
- 缩略图生成
- 项目验证

## 🔌 API 端点

| 端点 | 方法 | 描述 | 认证 |
|------|------|------|------|
| `/api/users/register` | POST | 用户注册 | ❌ |
| `/api/users/login` | POST | 用户登录 | ❌ |
| `/api/users/me` | GET | 获取当前用户 | ✅ |
| `/api/projects` | GET | 获取项目列表 | ❌ |
| `/api/projects` | POST | 创建项目 | ✅ |
| `/api/projects/:id` | GET | 获取项目详情 | ❌ |
| `/api/projects/:id/sb3` | GET | 下载 SB3 文件 | ❌ |
| `/api/cloud` | GET/POST | 云变量操作 | ✅ |
| `/api/competitions` | GET | 获取竞赛列表 | ❌ |
| `/api/competitions/:id/submit` | POST | 提交作品 | ✅ |
| `/api/competitions/:id/leaderboard` | GET | 排行榜 | ❌ |

## 🗄️ 数据库

使用 PostgreSQL，主要表结构：

- `users`: 用户信息
- `projects`: 项目元数据
- `project_versions`: 项目历史版本
- `competitions`: 竞赛信息
- `submissions`: 提交记录
- `classrooms`: 课堂（预留）
- `cloud_variable_history`: 云变量历史

## 🔒 安全特性

- JWT 认证
- 密码 bcrypt 哈希
- CSP 安全头部
- 文件上传限制（50MB）
- SB3 文件验证
- 用户数据隔离

## 📈 扩展性设计

### 插件系统

```typescript
import { PerformanceMonitorPlugin } from '@platform/tw-engine';

engine.use(new PerformanceMonitorPlugin());
```

### 竞赛系统

- 自动评测（Headless Runner）
- 排行榜
- 提交次数限制

### 课堂管理（预留）

- 教师/学生角色
- 班级代码加入
- 作业下发与收集

## 🛠️ 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React, TypeScript |
| 引擎 | @turbowarp/scratch-vm |
| 后端 | Node.js, Express, TypeScript |
| 数据库 | PostgreSQL |
| 缓存 | Redis |
| 对象存储 | MinIO (S3 兼容) |
| 容器化 | Docker, Docker Compose |

## 📝 License

MIT
