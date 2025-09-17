// 七牛云到本地文件系统的迁移脚本
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const https = require('https');
const dotenv = require('dotenv');
const qiniu = require('qiniu');

// 加载环境变量
dotenv.config();

// 七牛云配置
const accessKey = process.env.QINIU_ACCESS_KEY;
const secretKey = process.env.QINIU_SECRET_KEY;
const bucket = process.env.QINIU_BUCKET;
const domain = process.env.QINIU_DOMAIN;

// 本地存储配置
const STORAGE_PATH = process.env.STORAGE_PATH || './storage';

// 检查必要的环境变量
function checkEnvVars() {
  const requiredVars = ['QINIU_ACCESS_KEY', 'QINIU_SECRET_KEY', 'QINIU_BUCKET', 'QINIU_DOMAIN'];
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error(`❌ 缺少必要的环境变量: ${missingVars.join(', ')}`);
    console.error('请确保 .env 文件包含了所有七牛云配置信息');
    process.exit(1);
  }
}

// 初始化七牛云SDK
function initQiniu() {
  const mac = new qiniu.auth.digest.Mac(accessKey, secretKey);
  const config = new qiniu.conf.Config();
  // 根据存储区域设置对应的机房
  // config.zone = qiniu.zone.Zone_z0; // 华东
  // config.zone = qiniu.zone.Zone_z1; // 华北
  // config.zone = qiniu.zone.Zone_z2; // 华南
  // config.zone = qiniu.zone.Zone_na0; // 北美
  
  const bucketManager = new qiniu.rs.BucketManager(mac, config);
  return bucketManager;
}

// 确保本地存储目录存在
async function ensureStorageDirExists() {
  try {
    if (!fsSync.existsSync(STORAGE_PATH)) {
      fsSync.mkdirSync(STORAGE_PATH, { recursive: true });
      console.log(`✅ 存储目录已创建: ${STORAGE_PATH}`);
    } else {
      console.log(`✅ 使用现有存储目录: ${STORAGE_PATH}`);
    }
  } catch (error) {
    console.error('❌ 创建存储目录失败:', error);
    process.exit(1);
  }
}

// 获取七牛云文件列表
async function listQiniuFiles(bucketManager, prefix = '', marker = '') {
  return new Promise((resolve, reject) => {
    const options = {
      limit: 1000, // 每页获取的文件数量
      prefix: prefix // 目录前缀
    };
    
    if (marker) {
      options.marker = marker;
    }
    
    bucketManager.listPrefix(bucket, options, (err, respBody, respInfo) => {
      if (err) {
        reject(err);
        return;
      }
      
      if (respInfo.statusCode !== 200) {
        reject(new Error(`获取文件列表失败，状态码: ${respInfo.statusCode}`));
        return;
      }
      
      resolve(respBody);
    });
  });
}

// 下载单个文件
async function downloadFile(fileKey, fileUrl, localFilePath) {
  return new Promise((resolve, reject) => {
    // 确保目标目录存在
    const dir = path.dirname(localFilePath);
    if (!fsSync.existsSync(dir)) {
      fsSync.mkdirSync(dir, { recursive: true });
    }
    
    const file = fsSync.createWriteStream(localFilePath);
    
    console.log(`正在下载: ${fileKey}`);
    
    const request = https.get(fileUrl, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`下载失败，状态码: ${response.statusCode}`));
        file.close();
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        console.log(`✅ 下载完成: ${fileKey}`);
        resolve();
      });
    }).on('error', (err) => {
      fsSync.unlink(localFilePath, () => {}); // 删除不完整的文件
      reject(new Error(`下载错误: ${err.message}`));
    });
    
    // 设置超时（30秒）
    request.setTimeout(30000, () => {
      request.abort();
      reject(new Error('下载超时'));
    });
  });
}

// 批量下载文件
async function batchDownloadFiles(bucketManager, files) {
  let successCount = 0;
  let failedCount = 0;
  const failedFiles = [];
  
  for (const file of files) {
    if (file.key && !file.key.endsWith('/')) { // 排除文件夹
      const localFilePath = path.join(STORAGE_PATH, file.key);
      
      try {
        // 生成临时下载URL
        const deadline = Math.floor(Date.now() / 1000) + 3600; // 1小时有效期
        const downloadUrl = bucketManager.privateDownloadUrl(domain, file.key, deadline);
        
        // 下载文件
        await downloadFile(file.key, downloadUrl, localFilePath);
        successCount++;
      } catch (error) {
        console.error(`❌ 下载失败: ${file.key}`, error.message);
        failedCount++;
        failedFiles.push({
          key: file.key,
          error: error.message
        });
      }
    }
  }
  
  return {
    success: successCount,
    failed: failedCount,
    failedFiles: failedFiles
  };
}

// 主函数
async function main() {
  console.log('====================================');
  console.log('      七牛云到本地文件系统迁移       ');
  console.log('====================================\n');
  
  // 检查环境变量
  checkEnvVars();
  
  // 初始化
  const bucketManager = initQiniu();
  await ensureStorageDirExists();
  
  let allFiles = [];
  let marker = '';
  let page = 1;
  
  console.log('开始获取七牛云文件列表...');
  
  // 分页获取所有文件
  do {
    try {
      const result = await listQiniuFiles(bucketManager, '', marker);
      
      if (result.items && result.items.length > 0) {
        allFiles = allFiles.concat(result.items);
        console.log(`已获取第 ${page} 页，共 ${result.items.length} 个文件`);
      }
      
      marker = result.marker || '';
      page++;
    } catch (error) {
      console.error('❌ 获取文件列表失败:', error);
      process.exit(1);
    }
  } while (marker);
  
  console.log(`\n✅ 成功获取 ${allFiles.length} 个文件\n`);
  
  if (allFiles.length === 0) {
    console.log('没有文件需要迁移');
    process.exit(0);
  }
  
  // 确认是否继续
  console.log('注意: 这个操作会将所有文件下载到本地存储目录');
  console.log('请确保您的服务器有足够的磁盘空间');
  
  // 在Node.js脚本中，我们无法直接获取用户输入，所以默认继续
  console.log('\n开始迁移文件...\n');
  
  // 开始下载文件
  const startTime = Date.now();
  const result = await batchDownloadFiles(bucketManager, allFiles);
  const endTime = Date.now();
  const duration = Math.round((endTime - startTime) / 1000);
  
  // 输出迁移结果
  console.log('\n====================================');
  console.log('            迁移结果汇总             ');
  console.log('====================================');
  console.log(`总文件数: ${allFiles.length}`);
  console.log(`成功下载: ${result.success}`);
  console.log(`下载失败: ${result.failed}`);
  console.log(`总耗时: ${duration} 秒`);
  
  if (result.failed > 0) {
    console.log('\n下载失败的文件:');
    result.failedFiles.forEach(file => {
      console.log(`- ${file.key}: ${file.error}`);
    });
    
    // 保存失败列表到文件
    const failedListPath = path.join(__dirname, 'failed_migration.json');
    await fs.writeFile(failedListPath, JSON.stringify(result.failedFiles, null, 2));
    console.log(`\n失败列表已保存到: ${failedListPath}`);
  }
  
  console.log('\n迁移完成！您现在可以使用 `npm run start:local` 启动本地文件系统版本的服务。');
}

// 运行主函数
main().catch(error => {
  console.error('❌ 迁移过程中发生错误:', error);
  process.exit(1);
});