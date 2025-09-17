// 引入所需模块
const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const dotenv = require('dotenv');

// 加载环境变量
dotenv.config();

// 创建Express应用
const app = express();
const PORT = process.env.PORT || 3000;

// 配置静态文件目录
app.use(express.static(path.join(__dirname, 'public')));

// 解析JSON请求体
app.use(express.json());

// 配置本地文件存储路径
const STORAGE_PATH = process.env.STORAGE_PATH || path.join(__dirname, 'storage');

// 确保存储目录存在
async function ensureStorageDirExists() {
  try {
    if (!fsSync.existsSync(STORAGE_PATH)) {
      fsSync.mkdirSync(STORAGE_PATH, { recursive: true });
      console.log(`存储目录已创建: ${STORAGE_PATH}`);
    }
  } catch (error) {
    console.error('创建存储目录失败:', error);
  }
}

// 初始化存储目录
ensureStorageDirExists();

// 检查文件是否为音频文件的辅助函数
function isAudioFile(filename) {
  const audioExtensions = ['.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a'];
  const ext = path.extname(filename).toLowerCase();
  return audioExtensions.includes(ext);
}

// 格式化文件大小
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 获取文件列表API
app.get('/api/files', async (req, res) => {
  try {
    // 解析查询参数
    const prefix = req.query.prefix || ''; // 文件夹前缀
    
    // 构建实际的文件系统路径
    let currentDir = STORAGE_PATH;
    if (prefix) {
      // 防止路径遍历攻击
      const safePrefix = prefix.replace(/\.\./g, '');
      currentDir = path.join(STORAGE_PATH, safePrefix);
    }
    
    console.log('读取目录:', currentDir);
    
    // 检查目录是否存在
    try {
      await fs.access(currentDir);
    } catch (error) {
      // 目录不存在，返回空结果
      res.json({
        success: true,
        data: {
          files: [],
          folders: [],
          currentPrefix: prefix
        }
      });
      return;
    }
    
    // 读取目录内容
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    
    // 处理结果，区分文件和文件夹
    const files = [];
    const folders = [];
    
    for (const entry of entries) {
      const entryPath = path.join(currentDir, entry.name);
      const relativePath = prefix ? path.join(prefix, entry.name) : entry.name;
      
      if (entry.isDirectory()) {
        // 文件夹
        folders.push({
          name: entry.name,
          key: relativePath + '/', // 保持与七牛云API相同的格式
          isFolder: true
        });
      } else {
        // 文件
        try {
          const stats = await fs.stat(entryPath);
          const isAudio = isAudioFile(entry.name);
          
          files.push({
            name: entry.name,
            key: relativePath,
            url: `/api/files/${encodeURIComponent(relativePath)}`, // 本地文件URL
            size: stats.size,
            mimeType: 'application/octet-stream', // 简化处理，实际项目可以根据文件扩展名设置
            putTime: stats.mtime.getTime(),
            isAudio: isAudio
          });
        } catch (error) {
          console.error(`获取文件信息失败 ${entry.name}:`, error);
          // 跳过无法访问的文件
          continue;
        }
      }
    }
    
    res.json({
      success: true,
      data: {
        files: files,
        folders: folders,
        currentPrefix: prefix
      }
    });
  } catch (error) {
    console.error('获取文件列表失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '获取文件列表失败'
    });
  }
});

// 文件下载API（替代原有的临时URL）
app.get('/api/temp-url/:key', (req, res) => {
  try {
    // 解码key，因为URL中可能包含特殊字符
    const key = decodeURIComponent(req.params.key);
    console.log('生成临时URL请求，文件key:', key);
    
    // 构建本地文件的URL
    const localFileUrl = `/api/files/${encodeURIComponent(key)}`;
    
    res.json({
      success: true,
      data: {
        url: localFileUrl,
        key: key,
        domain: '' // 本地文件系统不需要域名
      },
      debug: {
        storagePath: STORAGE_PATH
      }
    });
  } catch (error) {
    console.error('生成临时URL失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '生成临时URL失败',
      debug: {
        errorStack: error.stack,
        storagePath: STORAGE_PATH
      }
    });
  }
});

// 代理API（用于提供本地文件内容）
app.get('/api/proxy/:key', (req, res) => {
  try {
    const key = decodeURIComponent(req.params.key);
    console.log('代理请求文件key:', key);
    
    // 构建实际的文件系统路径
    const safeKey = key.replace(/\.\./g, '');
    const filePath = path.join(STORAGE_PATH, safeKey);
    
    console.log('本地文件路径:', filePath);
    
    // 检查文件是否存在
    if (!fsSync.existsSync(filePath)) {
      res.status(404).json({
        success: false,
        message: '文件不存在'
      });
      return;
    }
    
    // 获取文件统计信息
    const stats = fsSync.statSync(filePath);
    
    // 设置适当的MIME类型
    let mimeType = 'application/octet-stream';
    const ext = path.extname(filePath).toLowerCase();
    
    // 简单的MIME类型映射
    const mimeTypes = {
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',
      '.flac': 'audio/flac',
      '.aac': 'audio/aac',
      '.m4a': 'audio/mp4',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.txt': 'text/plain'
    };
    
    if (mimeTypes[ext]) {
      mimeType = mimeTypes[ext];
    }
    
    // 设置响应头
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', stats.size);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(path.basename(filePath))}"`);
    
    // 禁止浏览器缓存（可选）
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // 创建文件读取流并发送
    const fileStream = fsSync.createReadStream(filePath);
    fileStream.pipe(res);
    
    // 处理流错误
    fileStream.on('error', (error) => {
      console.error('文件读取错误:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: '文件读取错误: ' + error.message
        });
      }
    });
    
    // 确保客户端断开连接时关闭流
    req.on('close', () => {
      fileStream.destroy();
    });
    
  } catch (error) {
    console.error('代理API错误:', error);
    res.status(500).json({
      success: false,
      message: '代理API内部错误: ' + error.message
    });
  }
});

// 首页路由
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log(`文件存储路径: ${STORAGE_PATH}`);
});