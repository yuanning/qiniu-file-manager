# 将七牛云文件存储迁移到本地服务器

本文档将指导您如何将七牛云文件管理器项目从使用七牛云存储切换到使用本地服务器存储文件，同时保留现有的样式和功能。

## 切换到本地文件系统版本

我们已经为您创建了一个专门用于本地文件系统的后端实现，您只需要以下几个简单步骤即可完成切换：

### 步骤 1: 准备环境

确保您的服务器上已安装以下软件：
- Node.js (推荐 v14 或更高版本)
- npm 或 yarn
- 足够的磁盘空间用于存储文件

### 步骤 2: 配置本地存储路径

1. 复制 `.env.local` 文件到 `.env`：

```bash
# Windows 环境
copy .env.local .env

# Linux/Mac 环境
cp .env.local .env
```

2. 打开 `.env` 文件，修改 `STORAGE_PATH` 配置项，设置为您希望存储文件的本地路径：

```env
# 例如：
STORAGE_PATH=d:/data/qiniu_files
# 或相对路径
# STORAGE_PATH=./storage
```

3. 如果该目录不存在，系统会在启动时自动创建。

### 步骤 3: 启动本地文件系统版本的服务

使用以下命令启动本地文件系统版本的服务：

```bash
# 使用 node 直接运行
node app_local_filesystem.js

# 或者使用 npm 脚本（我们会在下一步添加）
# npm run start:local
```

## 配置 package.json 添加本地版本启动脚本

为了方便启动本地版本，我们可以在 package.json 中添加一个专用的启动脚本：

```json
{
  "scripts": {
    "start": "node app.js",
    "dev": "nodemon app.js",
    "start:local": "node app_local_filesystem.js",
    "dev:local": "nodemon app_local_filesystem.js",
    "build": "node build.js",
    "build:unix": "mkdir -p dist && cp -r public/* dist/ && cp app.js package.json .env dist/"
  }
}
```

这样，您就可以使用 `npm run start:local` 来启动本地版本，或使用 `npm run dev:local` 进行开发（需要安装 nodemon）。

## 前端适配

我们已经保留了与七牛云版本完全相同的前端界面和API接口，因此您不需要对前端代码进行任何修改。前端会自动通过API与本地文件系统进行交互。

## 文件迁移（可选）

如果您希望将七牛云上已有的文件迁移到本地服务器，可以使用以下方法：

1. 使用七牛云提供的批量下载工具下载所有文件
2. 按照原始的文件目录结构，将下载的文件上传到您配置的 `STORAGE_PATH` 目录中

## 部署到生产环境

如果您想将本地文件系统版本部署到生产环境，可以按照以下步骤操作：

1. 完成上述所有配置
2. 使用 `npm run build` 命令打包项目
3. 将生成的 `dist` 目录部署到您的服务器上
4. 在服务器上安装生产依赖：
   ```bash
   cd dist
   npm install --production
   ```
5. 使用进程管理工具（如 PM2）启动服务：
   ```bash
   pm2 start app_local_filesystem.js --name qiniu-file-manager
   ```
6. 配置 Nginx 作为反向代理（参考项目中已有的 nginx.conf.example 文件）

## 本地文件系统版本的特性

1. **保留了所有原始功能**：文件浏览、文件夹导航、音频播放等功能都保持不变
2. **相同的API接口**：确保前端不需要任何修改
3. **灵活的存储路径配置**：可以通过环境变量轻松更改存储位置
4. **完善的错误处理**：包含详细的日志和错误提示
5. **支持基本的文件类型识别**：可以识别音频文件和其他常见文件类型

## 注意事项

1. 确保存储目录有正确的读写权限
2. 定期备份存储的文件数据
3. 如果需要处理大文件，可能需要调整 Node.js 的内存限制
4. 本地文件系统版本不提供文件上传功能，如果需要此功能，请参考高级配置部分
5. 对于生产环境，建议配置 HTTPS 以提高安全性

## 高级配置（可选）

### 添加文件上传功能

如果您需要文件上传功能，可以在 `app_local_filesystem.js` 中添加以下代码：

```javascript
// 文件上传API（需要安装 multer：npm install multer）
const multer = require('multer');
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const prefix = req.body.prefix || '';
      const safePrefix = prefix.replace(/\.\./g, '');
      const uploadDir = path.join(STORAGE_PATH, safePrefix);
      
      // 确保上传目录存在
      fsSync.mkdirSync(uploadDir, { recursive: true });
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      cb(null, file.originalname);
    }
  })
});

// 处理单文件上传
app.post('/api/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: '未找到文件' });
    }
    
    const prefix = req.body.prefix || '';
    const fileKey = prefix ? path.join(prefix, req.file.originalname) : req.file.originalname;
    
    res.json({
      success: true,
      data: {
        name: req.file.originalname,
        key: fileKey,
        size: req.file.size,
        path: req.file.path
      }
    });
  } catch (error) {
    console.error('文件上传失败:', error);
    res.status(500).json({
      success: false,
      message: '文件上传失败: ' + error.message
    });
  }
});
```

### 限制访问权限

为了提高安全性，您可以在生产环境中添加基本的访问控制：

```javascript
// 简单的基本认证中间件
function basicAuth(req, res, next) {
  // 在生产环境中启用认证
  if (process.env.NODE_ENV === 'production') {
    const auth = {
      user: process.env.AUTH_USER || 'admin',
      pass: process.env.AUTH_PASS || 'password'
    };
    
    const b64auth = (req.headers.authorization || '').split(' ')[1] || '';
    const [user, pass] = Buffer.from(b64auth, 'base64').toString().split(':');
    
    if (user && pass && user === auth.user && pass === auth.pass) {
      return next();
    }
    
    res.set('WWW-Authenticate', 'Basic realm="File Manager"');
    return res.status(401).send('Authentication required.');
  }
  
  next();
}

// 应用认证中间件到所有路由
app.use(basicAuth);
```

然后在 `.env` 文件中添加认证凭据：

```env
# 基本认证配置
AUTH_USER=admin
AUTH_PASS=your-secure-password
```

## 常见问题排查

1. **文件列表为空**：
   - 检查存储目录是否有文件
   - 确认存储路径配置正确
   - 检查目录权限是否正确

2. **音频文件无法播放**：
   - 确认文件格式受支持
   - 检查文件路径是否正确
   - 查看浏览器控制台的错误信息

3. **服务无法启动**：
   - 检查端口是否被占用
   - 确认 Node.js 版本兼容性
   - 查看日志中的错误信息

4. **文件访问权限问题**：
   - 确保 Node.js 进程有足够的权限访问存储目录
   - 检查文件系统的权限设置

如果您在迁移过程中遇到任何问题，请查看控制台日志获取详细的错误信息，或联系技术支持。