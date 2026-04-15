import VM from '@turbowarp/scratch-vm';
import Storage from '@turbowarp/scratch-storage';
import { TWOptions, TWEventType, TWEventCallback, ProjectSource, TWPlugin } from './types';

/**
 * TurboWarp Engine - 核心引擎封装类
 * 
 * 功能:
 * - 封装 scratch-vm + scratch-storage
 * - 统一 API：load/run/export/cloud
 * - 插件/扩展沙箱管理
 * - 事件驱动架构
 */
export class TWEngine {
  private vm: VM;
  private storage: Storage;
  private options: Required<TWOptions>;
  private projectData: ArrayBuffer | null = null;
  private eventListeners: Map<TWEventType, Set<TWEventCallback>> = new Map();
  private plugins: TWPlugin[] = [];
  private isRunning: boolean = false;

  constructor(options: TWOptions = {}) {
    this.options = this.mergeOptions(options);
    
    // 初始化存储模块
    this.storage = new Storage();
    this.setupStorage();
    
    // 初始化虚拟机
    this.vm = new VM();
    this.vm.attachStorage(this.storage);
    
    // 配置编译器
    this.setupCompiler();
    
    // 设置帧率
    if (this.options.framerate) {
      this.vm.setFramerate(this.options.framerate);
    }
    
    // 绑定事件
    this.bindVMEvents();
  }

  /**
   * 合并默认选项
   */
  private mergeOptions(options: TWOptions): Required<TWOptions> {
    return {
      assetBaseUrl: '/api/assets',
      enableCompiler: true,
      compilerOptions: {
        enabled: true,
        warpTimer: true,
        maxClones: 300,
        fencing: true,
      },
      framerate: 30,
      enableCloudVariables: true,
      cloudHost: '',
      userId: '',
      extensionWhitelist: [],
      ...options,
    };
  }

  /**
   * 配置存储模块 - 资源代理
   */
  private setupStorage() {
    // 添加 Web Store 用于资源代理
    this.storage.addWebStore(
      ['assets', 'project'],
      this.resolveAssetUrl.bind(this)
    );
  }

  /**
   * 解析资源 URL
   */
  private resolveAssetUrl(type: string, id: string): string {
    const baseUrl = this.options.assetBaseUrl.replace(/\/$/, '');
    return `${baseUrl}/${type}/${id}`;
  }

  /**
   * 配置 JIT 编译器
   */
  private setupCompiler() {
    if (this.options.enableCompiler) {
      this.vm.setCompilerOptions({
        enabled: true,
        warpTimer: this.options.compilerOptions.warpTimer,
        maxClones: this.options.compilerOptions.maxClones,
        fencing: this.options.compilerOptions.fencing,
      });
    }
  }

  /**
   * 绑定 VM 事件
   */
  private bindVMEvents() {
    // 运行状态变化
    this.vm.runtime.on('PROJECT_RUN_START', () => {
      this.isRunning = true;
      this.emit('run', { timestamp: Date.now() });
      this.plugins.forEach(p => p.onRunStart?.(this));
    });

    this.vm.runtime.on('PROJECT_RUN_STOP', () => {
      this.isRunning = false;
      this.emit('stop', { timestamp: Date.now() });
      this.plugins.forEach(p => p.onRunStop?.(this));
    });

    // 错误处理
    this.vm.runtime.on('PROJECT_ERROR', (error: Error) => {
      this.emit('error', { error, timestamp: Date.now() });
    });

    // 云变量变化
    if (this.options.enableCloudVariables) {
      this.vm.runtime.on('CLOUD_DATA_UPDATE', (data: any) => {
        this.emit('cloud', { data, timestamp: Date.now() });
        this.plugins.forEach(p => p.onCloudSync?.(this, data));
      });
    }
  }

  /**
   * 加载项目
   * @param source 项目数据源 (URL / File / ArrayBuffer)
   */
  async loadProject(source: ProjectSource): Promise<void> {
    try {
      const data = await this.normalizeSource(source);
      this.projectData = data;
      await this.vm.loadProject(data);
      
      this.emit('projectLoaded', { 
        projectId: this.vm.runtime.getProjectId(),
        targets: this.vm.runtime.targets.length,
        timestamp: Date.now()
      });

      // 通知插件
      this.plugins.forEach(p => p.onProjectLoad?.(this));
    } catch (error) {
      this.emit('error', { error, type: 'load', timestamp: Date.now() });
      throw error;
    }
  }

  /**
   * 标准化项目数据源
   */
  private async normalizeSource(source: ProjectSource): Promise<ArrayBuffer> {
    if (source instanceof ArrayBuffer) {
      return source;
    }
    
    if (source instanceof File) {
      return await source.arrayBuffer();
    }
    
    // URL 或 字符串
    const response = await fetch(source as string);
    if (!response.ok) {
      throw new Error(`Failed to load project: ${response.statusText}`);
    }
    return await response.arrayBuffer();
  }

  /**
   * 启动运行（绿旗）
   */
  start(): void {
    this.vm.greenFlag();
  }

  /**
   * 停止运行（红牌）
   */
  stop(): void {
    this.vm.stopAll();
  }

  /**
   * 导出当前项目为 SB3
   */
  async exportProject(): Promise<ArrayBuffer> {
    return await this.vm.saveProjectSb3();
  }

  /**
   * 获取项目缩略图
   */
  async getThumbnail(): Promise<string> {
    const stage = this.vm.runtime.getTargetForStage();
    if (!stage) return '';
    
    const renderer = this.vm.renderer;
    if (!renderer) return '';
    
    return renderer.extractCostumeData(stage.drawableID);
  }

  /**
   * 设置云变量值
   * @param name 变量名
   * @param value 变量值
   */
  setCloudVariable(name: string, value: string | number): void {
    if (!this.options.enableCloudVariables) {
      console.warn('Cloud variables are disabled');
      return;
    }

    // 添加用户前缀以隔离
    const prefixedName = this.options.userId ? `${this.options.userId}_${name}` : name;
    
    const stage = this.vm.runtime.getTargetForStage();
    if (stage) {
      this.vm.setVariableValue(stage.id, prefixedName, value);
    }
  }

  /**
   * 获取云变量值
   */
  getCloudVariable(name: string): any {
    const prefixedName = this.options.userId ? `${this.options.userId}_${name}` : name;
    const stage = this.vm.runtime.getTargetForStage();
    if (!stage) return undefined;
    
    return this.vm.getVariableValue(stage.id, prefixedName);
  }

  /**
   * 获取所有变量
   */
  getAllVariables(): Record<string, any> {
    return this.vm.runtime.getAllVariables();
  }

  /**
   * 注册事件监听器
   */
  on(event: TWEventType, callback: TWEventCallback): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
  }

  /**
   * 移除事件监听器
   */
  off(event: TWEventType, callback: TWEventCallback): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  /**
   * 触发事件
   */
  private emit(event: TWEventType, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(cb => cb(data));
    }
  }

  /**
   * 注册插件
   */
  use(plugin: TWPlugin): void {
    this.plugins.push(plugin);
    plugin.init(this);
  }

  /**
   * 获取 VM 实例（高级用法）
   */
  getVM(): VM {
    return this.vm;
  }

  /**
   * 获取存储实例
   */
  getStorage(): Storage {
    return this.storage;
  }

  /**
   * 检查是否正在运行
   */
  getIsRunning(): boolean {
    return this.isRunning;
  }

  /**
   * 销毁引擎
   */
  dispose(): void {
    this.stop();
    this.eventListeners.clear();
    this.plugins = [];
    // @ts-ignore - 清理 VM
    if (this.vm && typeof this.vm.dispose === 'function') {
      this.vm.dispose();
    }
  }
}
