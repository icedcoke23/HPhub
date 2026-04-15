import React, { useEffect, useRef, useState, useCallback } from 'react';
import { TWEngine } from '../TWEngine';
import { TWOptions } from '../types';

/**
 * TWEditor 组件属性
 */
export interface TWEditorProps {
  /** 项目 ID */
  projectId?: string;
  /** 初始项目数据 (URL/File/ArrayBuffer) */
  initialProject?: string | File | ArrayBuffer;
  /** 引擎选项 */
  options?: TWOptions;
  /** 保存回调 */
  onSave?: (data: ArrayBuffer) => void;
  /** 只读模式 */
  readOnly?: boolean;
  /** 自定义类名 */
  className?: string;
  /** 自定义样式 */
  style?: React.CSSProperties;
  /** 加载状态变化回调 */
  onLoadingChange?: (loading: boolean) => void;
  /** 错误回调 */
  onError?: (error: Error) => void;
}

/**
 * TurboWarp 编辑器组件
 * 
 * 集成 scratch-gui，提供完整的项目编辑功能
 */
export const TWEditor: React.FC<TWEditorProps> = ({
  projectId,
  initialProject,
  options = {},
  onSave,
  readOnly = false,
  className = '',
  style,
  onLoadingChange,
  onError,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<TWEngine | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // 初始化引擎
  useEffect(() => {
    if (!containerRef.current) return;

    // 创建引擎实例
    engineRef.current = new TWEngine({
      ...options,
      enableCloudVariables: options.enableCloudVariables ?? true,
    });

    const engine = engineRef.current;

    // 绑定事件
    engine.on('projectLoaded', () => {
      setIsLoading(false);
      onLoadingChange?.(false);
    });

    engine.on('error', ({ error: err }) => {
      setError(err as Error);
      onError?.(err as Error);
      setIsLoading(false);
      onLoadingChange?.(false);
    });

    // 挂载 GUI（需要引入 scratch-gui）
    // 注意：实际使用时需要导入并初始化 scratch-gui
    // 这里提供一个简化的示例
    const mountGUI = async () => {
      try {
        // 动态导入 scratch-gui
        const ScratchGUI = await import('@turbowarp/scratch-gui');
        
        if (containerRef.current && engine.getVM()) {
          // 初始化 GUI
          ScratchGUI.default({
            vm: engine.getVM(),
            onProjectChanged: handleProjectChanged,
            canSave: !readOnly,
            isShowingOnlyVisibleBlocks: false,
            hasCloudPermission: options.enableCloudVariables,
            cloudHost: options.cloudHost,
          });
        }
      } catch (err) {
        console.warn('scratch-gui not available, using basic mode');
        // 如果没有 GUI，至少可以运行项目
      }
    };

    mountGUI();

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, [projectId, readOnly, options, onLoadingChange, onError]);

  // 加载项目
  useEffect(() => {
    if (!engineRef.current) return;

    const loadProject = async () => {
      setIsLoading(true);
      onLoadingChange?.(true);

      try {
        if (initialProject) {
          await engineRef.current.loadProject(initialProject);
        } else if (projectId) {
          await engineRef.current.loadProject(`/api/projects/${projectId}/latest`);
        }
      } catch (err) {
        setError(err as Error);
        onError?.(err as Error);
      } finally {
        setIsLoading(false);
        onLoadingChange?.(false);
      }
    };

    loadProject();
  }, [projectId, initialProject, onLoadingChange, onError]);

  // 处理项目变更
  const handleProjectChanged = useCallback(() => {
    // 项目内容发生变化时的处理
  }, []);

  // 保存项目
  const handleSave = useCallback(async () => {
    if (!engineRef.current || !onSave) return;

    try {
      const data = await engineRef.current.exportProject();
      onSave(data);
    } catch (err) {
      console.error('Failed to save project:', err);
    }
  }, [onSave]);

  // 启动/停止
  const handleGreenFlag = useCallback(() => {
    engineRef.current?.start();
  }, []);

  const handleStopAll = useCallback(() => {
    engineRef.current?.stop();
  }, []);

  return (
    <div className={`tw-editor ${className}`} style={style}>
      {/* 工具栏 */}
      <div className="tw-editor-toolbar">
        <button onClick={handleGreenFlag} disabled={isLoading}>
          🚩 运行
        </button>
        <button onClick={handleStopAll} disabled={isLoading}>
          🛑 停止
        </button>
        {!readOnly && onSave && (
          <button onClick={handleSave} disabled={isLoading}>
          💾 保存
        </button>
        )}
      </div>

      {/* 加载状态 */}
      {isLoading && (
        <div className="tw-editor-loading">
          <span>加载中...</span>
        </div>
      )}

      {/* 错误显示 */}
      {error && (
        <div className="tw-editor-error">
          <span>错误：{error.message}</span>
        </div>
      )}

      {/* GUI 容器 */}
      <div 
        ref={containerRef} 
        className="tw-editor-container"
        style={{ display: isLoading ? 'none' : 'block' }}
      />
    </div>
  );
};

export default TWEditor;
