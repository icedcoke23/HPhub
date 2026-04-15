/**
 * TurboWarp Engine Options
 */
export interface TWOptions {
  /** 资源代理URL前缀 */
  assetBaseUrl?: string;
  /** 是否启用JIT编译器 */
  enableCompiler?: boolean;
  /** 编译器选项 */
  compilerOptions?: CompilerOptions;
  /** 帧率限制 */
  framerate?: number;
  /** 是否启用云变量 */
  enableCloudVariables?: boolean;
  /** 云变量服务URL */
  cloudHost?: string;
  /** 用户ID（用于云变量隔离） */
  userId?: string;
  /** 扩展白名单 */
  extensionWhitelist?: string[];
}

/**
 * 编译器选项
 */
export interface CompilerOptions {
  enabled: boolean;
  warpTimer?: boolean;
  maxClones?: number;
  fencing?: boolean;
}

/**
 * 事件类型
 */
export type TWEventType = 'run' | 'stop' | 'error' | 'cloud' | 'projectLoaded' | 'assetLoaded';

/**
 * 事件回调
 */
export type TWEventCallback = (data: any) => void;

/**
 * 项目数据源类型
 */
export type ProjectSource = string | File | ArrayBuffer;

/**
 * 插件接口
 */
export interface TWPlugin {
  name: string;
  version: string;
  init(engine: TWEngine): void;
  onProjectLoad?: (engine: TWEngine) => void;
  onRunStart?: (engine: TWEngine) => void;
  onRunStop?: (engine: TWEngine) => void;
  onCloudSync?: (engine: TWEngine, data: any) => void;
}
