/**
 * @platform/tw-engine
 * 
 * TurboWarp 引擎封装包
 * 提供标准化 React 组件与 SDK，屏蔽底层复杂度
 */

// 核心引擎
export { TWEngine } from './TWEngine';

// 类型定义
export type {
  TWOptions,
  CompilerOptions,
  TWEventType,
  TWEventCallback,
  ProjectSource,
  TWPlugin,
} from './types';

// React 组件
export { TWEditor } from './components/TWEditor';
export type { TWEditorProps } from './components/TWEditor';

export { TWPlayer } from './components/TWPlayer';
export type { TWPlayerProps } from './components/TWPlayer';

// 插件系统
export {
  PerformanceMonitorPlugin,
  CloudSyncPlugin,
  AutoSavePlugin,
  SecuritySandboxPlugin,
} from './plugins';
