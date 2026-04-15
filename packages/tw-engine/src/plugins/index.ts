/**
 * 插件系统入口
 */

export { TWPlugin } from '../types';

/**
 * 示例插件：性能监控插件
 * 
 * 监控项目运行时的性能指标
 */
export class PerformanceMonitorPlugin implements TWPlugin {
  name = 'performance-monitor';
  version = '1.0.0';

  private engine: any = null;
  private frameCount = 0;
  private lastTime = 0;
  private fps = 0;

  init(engine: any): void {
    this.engine = engine;

    // 监听运行开始
    engine.on('run', () => {
      this.frameCount = 0;
      this.lastTime = performance.now();
      this.startMonitoring();
    });

    // 监听运行停止
    engine.on('stop', () => {
      this.stopMonitoring();
      console.log(`[Performance] Final FPS: ${this.fps.toFixed(2)}`);
    });
  }

  private startMonitoring(): void {
    const monitor = () => {
      if (!this.engine.getIsRunning()) return;

      this.frameCount++;
      const currentTime = performance.now();
      const elapsed = currentTime - this.lastTime;

      if (elapsed >= 1000) {
        this.fps = (this.frameCount * 1000) / elapsed;
        console.log(`[Performance] FPS: ${this.fps.toFixed(2)}`);
        this.frameCount = 0;
        this.lastTime = currentTime;
      }

      requestAnimationFrame(monitor);
    };

    requestAnimationFrame(monitor);
  }

  private stopMonitoring(): void {
    // 停止监控
  }

  getFPS(): number {
    return this.fps;
  }
}

/**
 * 示例插件：云变量同步插件
 * 
 * 自动同步云变量到服务端
 */
export class CloudSyncPlugin implements TWPlugin {
  name = 'cloud-sync';
  version = '1.0.0';

  private syncUrl: string;
  private userId: string;
  private debounceTimer: any = null;

  constructor(syncUrl: string, userId: string) {
    this.syncUrl = syncUrl;
    this.userId = userId;
  }

  init(engine: any): void {
    // 监听云变量变化
    engine.on('cloud', (data: any) => {
      this.debouncedSync(data.data);
    });

    // 项目加载时获取最新云变量
    engine.on('projectLoaded', async () => {
      await this.loadCloudData(engine);
    });
  }

  private debouncedSync(data: any): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.sync(data);
    }, 1000); // 1 秒防抖
  }

  private async sync(data: any): Promise<void> {
    try {
      await fetch(this.syncUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: this.userId,
          variables: data,
          timestamp: Date.now(),
        }),
      });
    } catch (error) {
      console.error('[CloudSync] Failed to sync:', error);
    }
  }

  private async loadCloudData(engine: any): Promise<void> {
    try {
      const response = await fetch(`${this.syncUrl}?userId=${this.userId}`);
      const data = await response.json();

      if (data.variables) {
        Object.entries(data.variables).forEach(([key, value]: [string, any]) => {
          engine.setCloudVariable(key, value);
        });
      }
    } catch (error) {
      console.error('[CloudSync] Failed to load cloud data:', error);
    }
  }
}

/**
 * 示例插件：自动保存插件
 * 
 * 定期自动保存项目到本地存储
 */
export class AutoSavePlugin implements TWPlugin {
  name = 'auto-save';
  version = '1.0.0';

  private saveInterval: number;
  private timer: any = null;

  constructor(saveIntervalMs: number = 60000) {
    this.saveInterval = saveIntervalMs;
  }

  init(engine: any): void {
    // 项目加载后开始自动保存
    engine.on('projectLoaded', () => {
      this.startAutoSave(engine);
    });

    // 项目停止时也可以触发保存
    engine.on('stop', () => {
      this.save(engine);
    });
  }

  private startAutoSave(engine: any): void {
    this.timer = setInterval(() => {
      this.save(engine);
    }, this.saveInterval);
  }

  private async save(engine: any): Promise<void> {
    try {
      const data = await engine.exportProject();
      
      // 保存到 IndexedDB 或 localStorage
      const blob = new Blob([data], { type: 'application/x.scratch.sb3' });
      const url = URL.createObjectURL(blob);
      
      localStorage.setItem('autosave-project', url);
      localStorage.setItem('autosave-timestamp', Date.now().toString());
      
      console.log('[AutoSave] Project saved');
    } catch (error) {
      console.error('[AutoSave] Failed to save:', error);
    }
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

/**
 * 示例插件：安全沙箱插件
 * 
 * 限制扩展加载和外部资源访问
 */
export class SecuritySandboxPlugin implements TWPlugin {
  name = 'security-sandbox';
  version = '1.0.0';

  private whitelist: Set<string>;

  constructor(whitelist: string[] = []) {
    this.whitelist = new Set(whitelist);
  }

  init(engine: any): void {
    const vm = engine.getVM();

    // 拦截扩展加载
    if (vm.extensionManager) {
      const originalLoadExtension = vm.extensionManager.loadExtensionURL;
      vm.extensionManager.loadExtensionURL = async (extensionId: string) => {
        if (!this.isAllowed(extensionId)) {
          throw new Error(`Extension not allowed: ${extensionId}`);
        }
        return originalLoadExtension.call(vm.extensionManager, extensionId);
      };
    }

    console.log('[SecuritySandbox] Initialized with whitelist:', Array.from(this.whitelist));
  }

  private isAllowed(extensionId: string): boolean {
    if (this.whitelist.size === 0) return true;
    return this.whitelist.has(extensionId);
  }

  addAllowedExtension(extensionId: string): void {
    this.whitelist.add(extensionId);
  }

  removeAllowedExtension(extensionId: string): void {
    this.whitelist.delete(extensionId);
  }
}
