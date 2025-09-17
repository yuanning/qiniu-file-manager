const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 检查环境
const isWindows = process.platform === 'win32';

// 清理dist目录
function cleanDist() {
  if (fs.existsSync('./dist')) {
    console.log('清理dist目录...');
    if (isWindows) {
      execSync('rd /s /q dist');
    } else {
      execSync('rm -rf dist');
    }
  }
}

// 创建dist目录
function createDist() {
  console.log('创建dist目录...');
  fs.mkdirSync('./dist', { recursive: true });
}

// 复制文件到dist目录
function copyFiles() {
  console.log('复制文件到dist目录...');
  
  // 复制public目录下的所有文件
  const publicDir = path.join(__dirname, 'public');
  const distPublicDir = path.join(__dirname, 'dist');
  
  // 递归复制public目录
  copyDirectory(publicDir, distPublicDir);
  
  // 复制根目录下的必要文件
  const filesToCopy = ['app.js', 'package.json'];
  
  // 检查.env文件是否存在
  if (fs.existsSync('.env')) {
    filesToCopy.push('.env');
  } else if (fs.existsSync('.env.example')) {
    // 如果没有.env文件但有.env.example，复制示例文件
    console.log('警告：未找到.env文件，复制.env.example作为替代');
    fs.copyFileSync('.env.example', path.join(distPublicDir, '.env'));
  }
  
  // 复制其他必要文件
  filesToCopy.forEach(file => {
    if (fs.existsSync(file)) {
      fs.copyFileSync(file, path.join(distPublicDir, file));
      console.log(`复制 ${file} 成功`);
    } else {
      console.log(`警告：文件 ${file} 不存在，跳过复制`);
    }
  });
}

// 递归复制目录
function copyDirectory(source, target) {
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target);
  }
  
  fs.readdirSync(source).forEach(item => {
    const sourcePath = path.join(source, item);
    const targetPath = path.join(target, item);
    
    if (fs.statSync(sourcePath).isDirectory()) {
      copyDirectory(sourcePath, targetPath);
    } else {
      fs.copyFileSync(sourcePath, targetPath);
    }
  });
}

// 生成Nginx配置示例
function generateNginxConfig() {
  const nginxConfig = `server {
    listen 80;
    server_name your-domain.com; # 替换为您的域名
    
    root /path/to/dist; # 替换为dist目录的绝对路径
    index index.html;
    
    location / {
      try_files $uri $uri/ /index.html;
    }
    
    location /api {
      proxy_pass http://localhost:3000; # 代理到Node.js服务
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection 'upgrade';
      proxy_set_header Host $host;
      proxy_cache_bypass $http_upgrade;
    }
    
    # 静态资源缓存
    location ~* \.(css|js|jpg|jpeg|png|gif|svg|ico)$ {
      expires 30d;
      add_header Cache-Control "public, max-age=2592000";
    }
    
    # 错误页面
    error_page 404 /index.html;
  }
`;
  
  fs.writeFileSync('./nginx.conf.example', nginxConfig);
  console.log('生成nginx.conf.example配置文件成功');
}

// 创建README_NGINX_DEPLOY.md说明文档
function generateDeployDoc() {
  const deployDoc = `# 部署到Nginx指南

本项目可以打包并部署到Nginx服务器上。以下是详细的部署步骤：

## 前提条件

1. 安装Node.js和npm
2. 安装Nginx
3. 准备环境变量配置（.env文件）

## 打包项目

### 在Windows环境下

\`\`\`bash
node build.js
\`\`\`

### 在Linux/Mac环境下

\`\`\`bash
npm run build
\`\`\`

打包完成后，会在项目根目录生成一个\`dist\`文件夹，包含所有需要部署的文件。

## 安装依赖

进入dist目录并安装依赖：

\`\`\`bash
cd dist
npm install --production
\`\`\`

## 配置Nginx

1. 将生成的\`nginx.conf.example\`文件复制到Nginx的配置目录
2. 修改配置文件中的以下内容：
   - \`server_name\`: 替换为您的域名
   - \`root\`: 替换为dist目录的绝对路径

3. 重启Nginx服务：

   \`\`\`bash
   # 在Ubuntu/Debian上
   sudo service nginx restart
   
   # 在CentOS/RHEL上
   sudo systemctl restart nginx
   \`\`\`

## 启动Node.js服务

在dist目录下启动Node.js服务：

\`\`\`bash
# 使用pm2进程管理器（推荐）
npm install -g pm2
pm start # 或者直接执行 node app.js
\`\`\`

## 环境变量配置

确保您的\`.env\`文件包含以下必要的环境变量：

\`\`\`
QINIU_ACCESS_KEY=您的七牛云AccessKey
QINIU_SECRET_KEY=您的七牛云SecretKey
QINIU_BUCKET=您的七牛云存储空间名称
QINIU_DOMAIN=您的七牛云域名
PORT=3000 # Node.js服务端口
\`\`\`

## 注意事项

1. 确保Nginx用户对dist目录有读取权限
2. 如果使用防火墙，确保80端口和3000端口已开放
3. 对于生产环境，建议配置HTTPS（可以使用Let's Encrypt免费证书）
4. 推荐使用进程管理器如pm2来管理Node.js服务，确保服务稳定运行

## 常见问题排查

1. 如果访问API时报错，检查Node.js服务是否正常运行
2. 如果静态文件无法加载，检查Nginx的root配置是否正确
3. 如果出现跨域问题，在Nginx配置中添加跨域头
`;
  
  fs.writeFileSync('./README_NGINX_DEPLOY.md', deployDoc);
  console.log('生成README_NGINX_DEPLOY.md部署文档成功');
}

// 执行打包流程
function build() {
  try {
    console.log('开始打包项目...');
    cleanDist();
    createDist();
    copyFiles();
    generateNginxConfig();
    generateDeployDoc();
    console.log('项目打包成功！输出目录：dist');
  } catch (error) {
    console.error('打包失败:', error);
    process.exit(1);
  }
}

// 执行打包
build();