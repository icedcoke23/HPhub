import { Router, Request, Response } from 'express';
import axios from 'axios';

const router = Router();

const ASSET_PROXY_URL = process.env.ASSET_PROXY_URL || 'https://cdn.turbowarp.org';

/**
 * GET /api/assets/assets/:id - 获取 Scratch 资产（造型、声音等）
 * 
 * 代理到 TurboWarp/Scratch CDN，带缓存
 */
router.get('/assets/:md5ext', async (req: Request, res: Response) => {
  const { md5ext } = req.params;
  
  try {
    // 从 CDN 获取资产
    const response = await axios.get(`${ASSET_PROXY_URL}/internalapi/asset/${md5ext}`, {
      responseType: 'arraybuffer',
      timeout: 10000,
    });

    // 设置缓存头
    res.setHeader('Cache-Control', 'public, max-age=2592000'); // 30 天
    res.setHeader('Content-Type', getContentType(md5ext));
    
    res.send(response.data);
  } catch (error: any) {
    if (error.response?.status === 404) {
      res.status(404).json({ error: 'Asset not found' });
    } else {
      res.status(500).json({ error: 'Failed to fetch asset' });
    }
  }
});

/**
 * GET /api/assets/project/:id - 获取项目文件
 */
router.get('/project/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  
  try {
    const response = await axios.get(`${ASSET_PROXY_URL}/projects/${id}`, {
      responseType: 'arraybuffer',
      timeout: 15000,
    });

    res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 小时
    res.setHeader('Content-Type', 'application/x.scratch.sb3');
    res.setHeader('Content-Disposition', `attachment; filename="project_${id}.sb3"`);
    
    res.send(response.data);
  } catch (error: any) {
    if (error.response?.status === 404) {
      res.status(404).json({ error: 'Project not found' });
    } else {
      res.status(500).json({ error: 'Failed to fetch project' });
    }
  }
});

/**
 * 根据文件扩展名判断 Content-Type
 */
function getContentType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  
  switch (ext) {
    case 'png':
      return 'image/png';
    case 'svg':
      return 'image/svg+xml';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'wav':
      return 'audio/wav';
    case 'mp3':
      return 'audio/mpeg';
    default:
      return 'application/octet-stream';
  }
}

export { router as assetRoutes };
