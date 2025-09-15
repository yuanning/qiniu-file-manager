# 七牛云文件管理器

这是一个基于Node.js的七牛云文件管理系统，可以通过API方式获取七牛云存储空间中的文件夹和文件，并支持音频文件的在线播放功能。

## 功能特性

- 浏览七牛云存储空间中的文件夹和文件
- 支持文件夹层级导航
- 在线播放音频文件（支持MP3、WAV、OGG、FLAC、AAC、M4A等格式）
- 响应式设计，支持移动端访问
- 优雅的UI界面

## 技术栈

- **后端**：Node.js + Express
- **前端**：HTML + CSS + JavaScript
- **云存储**：七牛云

## 安装和使用

### 前提条件

- 已安装Node.js（推荐v14+）
- 已注册七牛云账号并创建存储空间

### 安装依赖

```bash
npm install
```

### 配置七牛云

在项目根目录的`.env`文件中填写您的七牛云配置信息：

```
# 七牛云配置信息
QINIU_ACCESS_KEY=您的Access Key
QINIU_SECRET_KEY=您的Secret Key
QINIU_BUCKET=您的存储空间名称
QINIU_DOMAIN=您的域名
PORT=3000
```

> 注意：
> - Access Key和Secret Key可以在七牛云控制台的个人中心获取
> - QINIU_BUCKET是您创建的存储空间名称
> - QINIU_DOMAIN是您绑定的域名（可以使用七牛云提供的测试域名）
> - 如果您的存储空间是私有空间，系统会自动生成临时访问链接

### 启动项目

开发模式（使用nodemon自动重启）：

```bash
npm run dev
```

生产模式：

```bash
npm start
```

### 访问系统

打开浏览器，访问 `http://localhost:3000` 即可使用文件管理器。

## 项目结构

```
file-manager/
├── app.js            # 主应用文件，包含Express服务器和API路由
├── package.json      # 项目配置和依赖
├── .env              # 环境变量配置
├── public/           # 静态资源文件夹
│   ├── index.html    # 前端页面
│   ├── style.css     # 样式文件
│   └── app.js        # 前端交互逻辑
└── README.md         # 项目说明文档
```

## API接口说明

### 获取文件列表

```
GET /api/files?prefix=文件夹路径&limit=1000
```

**参数：**
- `prefix`：可选，文件夹路径前缀
- `limit`：可选，返回的文件数量限制

**返回示例：**

```json
{
  "success": true,
  "data": {
    "files": [
      {
        "name": "example.mp3",
        "key": "audio/example.mp3",
        "url": "https://your-domain.com/audio/example.mp3",
        "size": 3456789,
        "mimeType": "audio/mpeg",
        "putTime": 16345678901234567,
        "isAudio": true
      }
    ],
    "folders": [
      {
        "name": "audio",
        "key": "audio/",
        "isFolder": true
      }
    ],
    "currentPrefix": ""
  }
}
```

### 生成临时访问URL（私有空间）

```
GET /api/temp-url/:key
```

**参数：**
- `key`：文件的Key

**返回示例：**

```json
{
  "success": true,
  "data": {
    "url": "https://your-domain.com/file-key?e=1234567890&token=..."
  }
}
```

## 注意事项

1. 确保您的七牛云存储空间配置正确，并且有足够的访问权限
2. 对于私有空间，系统会自动生成临时访问链接，有效期为1小时
3. 音频播放功能可能会受到浏览器自动播放策略的限制
4. 如果您的存储空间不在华东区域，请修改`app.js`中的`config.zone`配置

## License

ISC