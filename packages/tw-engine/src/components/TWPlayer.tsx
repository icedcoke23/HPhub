import React, { useEffect, useRef, useState, useCallback } from 'react';
import { TWEngine } from '../TWEngine';
import { TWOptions } from '../types';

/**
 * TWPlayer 组件属性
 */
export interface TWPlayerProps {
  /** 项目 ID */
  projectId?: string;
  /** 初始项目数据 (URL/File/ArrayBuffer) */
  initialProject?: string | File | ArrayBuffer;
  /** 引擎选项 */
  options?: TWOptions;
  /** 自动播放 */
  autoPlay?: boolean;
  /** 循环播放 */
  loop?: boolean;
  /** 自定义类名 */
  className?: string;
  /** 自定义样式 */
  style?: React.CSSProperties;
  /** 加载状态变化回调 */
  onLoadingChange?: (loading: boolean) => void;
  /** 错误回调 */
  onError?: (error: Error) => void;
  /** 运行状态变化回调 */
  onRunStateChange?: (running: boolean) => void;
  /** 完成回调（项目运行结束时） */
  onComplete?: () => void;
}

/**
 * TurboWarp 播放器组件
 * 
 * 用于只读模式展示和运行 Scratch 项目
 * 适用于社区作品展示、竞赛提交预览等场景
 */
export const TWPlayer: React.FC<TWPlayerProps> = ({
  projectId,
  initialProject,
  options = {},
  autoPlay = false,
  loop = false,
  className = '',
  style,
  onLoadingChange,
  onError,
  onRunStateChange,
  onComplete,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<TWEngine | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // 初始化引擎
  useEffect(() => {
    if (!containerRef.current) return;

    // 创建引擎实例 - 播放器模式禁用编辑功能
    engineRef.current = new TWEngine({
      ...options,
      enableCloudVariables: options.enableCloudVariables ?? true,
    });

    const engine = engineRef.current;

    // 绑定事件
    engine.on('projectLoaded', () => {
      setIsLoading(false);
      onLoadingChange?.(false);
      
      // 自动播放
      if (autoPlay) {
        engine.start();
      }
    });

    engine.on('run', () => {
      setIsRunning(true);
      onRunStateChange?.(true);
    });

    engine.on('stop', () => {
      setIsRunning(false);
      onRunStateChange?.(false);
      
      // 循环播放
      if (loop && !isLoading) {
        setTimeout(() => engine.start(), 500);
      }
    });

    engine.on('error', ({ error: err }) => {
      setError(err as Error);
      onError?.(err as Error);
      setIsLoading(false);
      onLoadingChange?.(false);
    });

    // 创建简单的渲染容器
    const createPlayerUI = async () => {
      try {
        const vm = engine.getVM();
        const storage = engine.getStorage();
        
        // 初始化渲染器
        if (vm.renderer && containerRef.current) {
          // 设置渲染器尺寸
          const width = style?.width as number || 480;
          const height = style?.height as number || 360;
          
          vm.renderer.resize(width, height);
          
          // 将渲染器附加到 DOM
          const canvas = vm.renderer.canvas;
          if (canvas && containerRef.current) {
            containerRef.current.innerHTML = '';
            containerRef.current.appendChild(canvas);
          }
        }
      } catch (err) {
        console.error('Failed to create player UI:', err);
      }
    };

    createPlayerUI();

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, [projectId, autoPlay, loop, options, onLoadingChange, onError, onRunStateChange]);

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
          await engineRef.current.loadProject(`/api/projects/${projectId}/sb3`);
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

  // 控制方法
  const play = useCallback(() => {
    engineRef.current?.start();
  }, []);

  const pause = useCallback(() => {
    engineRef.current?.stop();
  }, []);

  const toggle = useCallback(() => {
    if (isRunning) {
      pause();
    } else {
      play();
    }
  }, [isRunning, play, pause]);

  return (
    <div className={`tw-player ${className}`} style={style}>
      {/* 控制栏 */}
      <div className="tw-player-controls">
        <button 
          onClick={toggle} 
          disabled={isLoading || !!error}
          className="tw-player-play-btn"
        >
          {isRunning ? '⏸️ 暂停' : '▶️ 播放'}
        </button>
        
        {!isLoading && (
          <span className="tw-player-status">
            {isRunning ? '运行中' : '已停止'}
          </span>
        )}
      </div>

      {/* 加载状态 */}
      {isLoading && (
        <div className="tw-player-loading">
          <div className="tw-player-spinner"></div>
          <span>加载项目中...</span>
        </div>
      )}

      {/* 错误显示 */}
      {error && (
        <div className="tw-player-error">
          <span>❌ {error.message}</span>
          <button onClick={() => window.location.reload()}>重试</button>
        </div>
      )}

      {/* 播放器容器 */}
      <div 
        ref={containerRef} 
        className="tw-player-container"
        style={{ 
          display: isLoading || error ? 'none' : 'block',
          width: '100%',
          height: '100%'
        }}
      />
    </div>
  );
};

export default TWPlayer;
