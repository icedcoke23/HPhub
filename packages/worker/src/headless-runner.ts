import VM from '@turbowarp/scratch-vm';
import Storage from '@turbowarp/scratch-storage';

/**
 * 测试用例接口
 */
export interface TestCase {
  id: string;
  name: string;
  timeout: number; // 超时时间（毫秒）
  input?: Record<string, any>; // 输入变量
  expectedOutput?: Record<string, any>; // 期望输出
}

/**
 * 评测结果
 */
export interface JudgeResult {
  submissionId: string;
  totalScore: number;
  maxScore: number;
  passed: boolean;
  testResults: Array<{
    testCaseId: string;
    passed: boolean;
    score: number;
    actualOutput?: any;
    expectedOutput?: any;
    error?: string;
    executionTime: number;
  }>;
}

/**
 * 无头运行器 - 用于竞赛自动评测
 * 
 * 在服务器端加载并运行 SB3 项目，捕获输出变量
 */
export class HeadlessRunner {
  private vm: VM;
  private storage: Storage;
  private timeout: number = 30000; // 默认 30 秒超时

  constructor(options?: { timeout?: number }) {
    this.timeout = options?.timeout || this.timeout;
    
    this.storage = new Storage();
    this.vm = new VM();
    this.vm.attachStorage(this.storage);
    
    // 启用编译器以获得更好性能
    this.vm.setCompilerOptions({
      enabled: true,
      warpTimer: true,
    });
  }

  /**
   * 加载项目
   */
  async loadProject(sb3Data: ArrayBuffer): Promise<void> {
    await this.vm.loadProject(sb3Data);
  }

  /**
   * 运行单个测试用例
   */
  async runTestCase(testCase: TestCase): Promise<{
    passed: boolean;
    actualOutput: Record<string, any>;
    executionTime: number;
    error?: string;
  }> {
    const startTime = Date.now();
    
    try {
      // 设置输入变量
      if (testCase.input) {
        const stage = this.vm.runtime.getTargetForStage();
        if (stage) {
          for (const [key, value] of Object.entries(testCase.input)) {
            this.vm.setVariableValue(stage.id, key, value);
          }
        }
      }

      // 启动运行
      this.vm.greenFlag();

      // 等待完成或超时
      await new Promise<void>((resolve, reject) => {
        const checkTimeout = setTimeout(() => {
          this.vm.stopAll();
          reject(new Error(`Test case timeout after ${testCase.timeout}ms`));
        }, testCase.timeout);

        // 简单实现：等待指定时间后检查输出
        // 实际应该监听特定事件或变量变化
        setTimeout(() => {
          clearTimeout(checkTimeout);
          this.vm.stopAll();
          resolve();
        }, testCase.timeout);
      });

      // 获取输出变量
      const actualOutput = this.getAllVariables();
      const executionTime = Date.now() - startTime;

      // 比较输出
      let passed = true;
      if (testCase.expectedOutput) {
        for (const [key, expectedValue] of Object.entries(testCase.expectedOutput)) {
          const actualValue = actualOutput[key];
          if (JSON.stringify(actualValue) !== JSON.stringify(expectedValue)) {
            passed = false;
            break;
          }
        }
      }

      return {
        passed,
        actualOutput,
        executionTime,
      };
    } catch (error: any) {
      return {
        passed: false,
        actualOutput: {},
        executionTime: Date.now() - startTime,
        error: error.message,
      };
    }
  }

  /**
   * 运行完整评测
   */
  async judge(
    sb3Data: ArrayBuffer,
    testCases: TestCase[],
    submissionId: string
  ): Promise<JudgeResult> {
    await this.loadProject(sb3Data);

    const testResults = [];
    let totalScore = 0;
    let maxScore = testCases.length;

    for (const testCase of testCases) {
      const result = await this.runTestCase(testCase);
      
      testResults.push({
        testCaseId: testCase.id,
        passed: result.passed,
        score: result.passed ? 1 : 0,
        actualOutput: result.actualOutput,
        expectedOutput: testCase.expectedOutput,
        error: result.error,
        executionTime: result.executionTime,
      });

      if (result.passed) {
        totalScore++;
      }

      // 如果某个测试失败且是关键测试，可以提前终止
      // 这里简化处理，继续执行所有测试
    }

    return {
      submissionId,
      totalScore,
      maxScore,
      passed: totalScore === maxScore,
      testResults,
    };
  }

  /**
   * 获取所有变量
   */
  private getAllVariables(): Record<string, any> {
    const variables: Record<string, any> = {};
    const allVars = this.vm.runtime.getAllVariables();
    
    for (const target of this.vm.runtime.targets) {
      for (const variable of Object.values(target.variables)) {
        variables[variable.name] = variable.value;
      }
    }
    
    return variables;
  }

  /**
   * 清理资源
   */
  dispose(): void {
    this.vm.stopAll();
    this.vm.dispose();
  }
}

/**
 * 生成项目缩略图
 */
export async function generateThumbnail(
  sb3Data: ArrayBuffer,
  width: number = 480,
  height: number = 360
): Promise<Buffer> {
  const storage = new Storage();
  const vm = new VM();
  vm.attachStorage(storage);

  await vm.loadProject(sb3Data);

  // 获取渲染器
  const renderer = vm.renderer;
  if (!renderer) {
    throw new Error('Renderer not available');
  }

  // 调整尺寸
  renderer.resize(width, height);

  // 渲染舞台
  const stage = vm.runtime.getTargetForStage();
  if (!stage) {
    throw new Error('Stage not found');
  }

  // 提取图像数据
  const imageData = renderer.extractCostumeData(stage.drawableID);
  
  // 转换为 Buffer
  const base64Data = imageData.split(',')[1];
  const buffer = Buffer.from(base64Data, 'base64');

  vm.dispose();

  return buffer;
}

// CLI 使用示例
if (require.main === module) {
  console.log('Headless Runner Module');
  console.log('Usage: Import and use HeadlessRunner class in your code');
}
