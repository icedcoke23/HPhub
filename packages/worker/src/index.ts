import dotenv from 'dotenv';
import { HeadlessRunner, generateThumbnail, TestCase } from './headless-runner';

dotenv.config();

/**
 * Worker 主入口
 * 
 * 负责处理：
 * - 竞赛自动评测任务
 * - 缩略图生成任务
 * - 项目验证任务
 */

console.log(`
╔════════════════════════════════════════════╗
║     Scratch Platform Worker                ║
╠════════════════════════════════════════════╣
║  Status: Starting...
║  PID: ${process.pid}
╚════════════════════════════════════════════╝
`);

// 模拟任务队列处理
class TaskQueue {
  private queue: Array<{ type: string; data: any }> = [];
  private processing: boolean = false;

  async add(type: string, data: any): Promise<void> {
    this.queue.push({ type, data });
    if (!this.processing) {
      this.process();
    }
  }

  private async process(): Promise<void> {
    if (this.queue.length === 0) {
      this.processing = false;
      return;
    }

    this.processing = true;
    const task = this.queue.shift()!;

    try {
      console.log(`[Worker] Processing task: ${task.type}`);
      
      switch (task.type) {
        case 'JUDGE_SUBMISSION':
          await this.handleJudgeSubmission(task.data);
          break;
        case 'GENERATE_THUMBNAIL':
          await this.handleGenerateThumbnail(task.data);
          break;
        case 'VALIDATE_PROJECT':
          await this.handleValidateProject(task.data);
          break;
        default:
          console.warn(`[Worker] Unknown task type: ${task.type}`);
      }
    } catch (error: any) {
      console.error(`[Worker] Task failed: ${task.type}`, error.message);
    }

    // 继续处理下一个任务
    setImmediate(() => this.process());
  }

  private async handleJudgeSubmission(data: {
    submissionId: string;
    sb3Data: ArrayBuffer;
    testCases: TestCase[];
  }): Promise<void> {
    console.log(`[Judge] Starting evaluation for submission: ${data.submissionId}`);
    
    const runner = new HeadlessRunner({ timeout: 60000 });
    
    try {
      const result = await runner.judge(
        data.sb3Data,
        data.testCases,
        data.submissionId
      );
      
      console.log(`[Judge] Result: ${result.totalScore}/${result.maxScore} - ${result.passed ? 'PASSED' : 'FAILED'}`);
      
      // 这里应该将结果发送到 API 服务器或消息队列
      // await fetch('http://api-server/api/submissions/${data.submissionId}/result', { ... })
      
    } finally {
      runner.dispose();
    }
  }

  private async handleGenerateThumbnail(data: {
    projectId: string;
    sb3Data: ArrayBuffer;
  }): Promise<void> {
    console.log(`[Thumbnail] Generating for project: ${data.projectId}`);
    
    try {
      const thumbnail = await generateThumbnail(data.sb3Data, 480, 360);
      
      console.log(`[Thumbnail] Generated ${thumbnail.length} bytes`);
      
      // 这里应该上传到 S3
      // await s3Client.putObject({ Bucket: 'thumbnails', Key: data.projectId, Body: thumbnail })
      
    } catch (error: any) {
      console.error(`[Thumbnail] Failed: ${error.message}`);
    }
  }

  private async handleValidateProject(data: {
    projectId: string;
    sb3Data: ArrayBuffer;
  }): Promise<void> {
    console.log(`[Validate] Validating project: ${data.projectId}`);
    
    const runner = new HeadlessRunner();
    
    try {
      await runner.loadProject(data.sb3Data);
      console.log(`[Validate] Project is valid`);
    } catch (error: any) {
      console.error(`[Validate] Project is invalid: ${error.message}`);
    } finally {
      runner.dispose();
    }
  }
}

// 创建全局任务队列
const taskQueue = new TaskQueue();

// 从 Redis 或其他消息队列监听任务
// 这里仅做示例，实际应连接 Redis/RabbitMQ
async function startWorker(): Promise<void> {
  console.log('[Worker] Started and waiting for tasks...');
  
  // 模拟接收任务
  setTimeout(() => {
    console.log('[Worker] Simulating task reception (in production, connect to Redis/RabbitMQ)');
  }, 1000);
}

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('[Worker] Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[Worker] Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

// 启动 Worker
startWorker().catch(console.error);

// 导出供其他模块使用
export { taskQueue, TaskQueue };
