// 引入所需模块
const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const qiniu = require('qiniu');

// 加载环境变量
dotenv.config();

// 创建Express应用
const app = express();
const PORT = process.env.PORT || 3000;

// 配置静态文件目录
app.use(express.static(path.join(__dirname, 'public')));

// 解析JSON请求体
app.use(express.json());

// 七牛云配置
const accessKey = process.env.QINIU_ACCESS_KEY;
const secretKey = process.env.QINIU_SECRET_KEY;
const bucket = process.env.QINIU_BUCKET;
const domain = process.env.QINIU_DOMAIN;

// 初始化七牛云认证对象
const mac = new qiniu.auth.digest.Mac(accessKey, secretKey);
const config = new qiniu.conf.Config();
config.zone = qiniu.zone.Zone_z0; // 华东区域，根据您的存储区域调整

// 确保URL格式正确的辅助函数
function ensureValidQiniuUrl(url) {
  // 检查URL是否已经包含http或https协议
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    // 添加http协议（避免https证书问题）
    return 'http://' + url;
  }
  return url;
}

// 生成公开访问URL的辅助函数
function generatePublicUrl(domain, key) {
  // 确保域名有正确的协议前缀
  const validDomain = ensureValidQiniuUrl(domain);
  // 直接构建URL，避免SDK可能的问题
  return `${validDomain}/${encodeURIComponent(key)}`;
}

// 获取文件列表API
app.get('/api/files', async (req, res) => {
  try {
    // 解析查询参数
    const prefix = req.query.prefix || ''; // 文件夹前缀
    const limit = parseInt(req.query.limit) || 1000;
    
    // 创建bucketManager实例
    const bucketManager = new qiniu.rs.BucketManager(mac, config);
    
    // 列出文件
    const listFilesPromise = new Promise((resolve, reject) => {
      bucketManager.listPrefix(bucket, {
        prefix: prefix,
        limit: limit
      }, (err, respBody, respInfo) => {
        if (err) {
          reject(err);
        } else {
          if (respInfo.statusCode === 200) {
            resolve(respBody);
          } else {
            reject(new Error(`请求失败: ${respInfo.statusCode}`));
          }
        }
      });
    });
    
    const result = await listFilesPromise;
    
    // 处理结果，区分文件和文件夹
    const files = [];
    const folders = new Set();
    
    if (result.items) {
      result.items.forEach(item => {
        // 判断是否是文件夹（有后缀斜杠但大小为0）
        if (item.key.endsWith('/') && item.fsize === 0) {
          folders.add(item.key);
        } else {
          // 生成公开访问URL - 直接构建而不是使用SDK，避免localhost问题
          const publicUrl = generatePublicUrl(domain, item.key);
          files.push({
            name: path.basename(item.key),
            key: item.key,
            url: publicUrl,
            size: item.fsize,
            mimeType: item.mimeType,
            putTime: item.putTime,
            isAudio: isAudioFile(item.key)
          });
        }
      });
    }
    
    // 处理公共前缀（文件夹）
    if (result.commonPrefixes) {
      result.commonPrefixes.forEach(prefix => {
        folders.add(prefix);
      });
    }
    
    // 转换Set为数组并格式化文件夹信息
    const foldersArray = Array.from(folders).map(folderKey => ({
      name: path.basename(folderKey).replace(/\/$/, ''),
      key: folderKey,
      isFolder: true
    }));
    
    res.json({
      success: true,
      data: {
        files: files,
        folders: foldersArray,
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

// 检查文件是否为音频文件的辅助函数
function isAudioFile(filename) {
  const audioExtensions = ['.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a'];
  const ext = path.extname(filename).toLowerCase();
  return audioExtensions.includes(ext);
}

// 生成临时访问URL的API（用于私有空间）
app.get('/api/temp-url/:key', (req, res) => {
  try {
    const key = req.params.key;
    const bucketManager = new qiniu.rs.BucketManager(mac, config);
    
    // 生成临时URL，有效期1小时
    const deadline = Math.floor(Date.now() / 1000) + 3600;
    // 确保域名格式正确
    const validDomain = ensureValidQiniuUrl(domain);
    // 使用修正后的域名生成临时URL
    const privateUrl = bucketManager.privateDownloadUrl(validDomain, key, deadline);
    
    res.json({
      success: true,
      data: {
        url: privateUrl
      }
    });
  } catch (error) {
    console.error('生成临时URL失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '生成临时URL失败'
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
});