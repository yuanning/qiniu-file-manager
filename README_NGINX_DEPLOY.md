# 部署到Nginx指南

本项目可以打包并部署到Nginx服务器上。以下是详细的部署步骤：

## 前提条件

1. 安装Node.js和npm
2. 安装Nginx
3. 准备环境变量配置（.env文件）

## 打包项目

### 在Windows环境下

```bash
node build.js
```

### 在Linux/Mac环境下

```bash
npm run build
```

打包完成后，会在项目根目录生成一个`dist`文件夹，包含所有需要部署的文件。

## 安装依赖

进入dist目录并安装依赖：

```bash
cd dist
npm install --production
```

## 配置Nginx

1. 将生成的`nginx.conf.example`文件复制到Nginx的配置目录
2. 修改配置文件中的以下内容：
   - `server_name`: 替换为您的域名
   - `root`: 替换为dist目录的绝对路径

3. 重启Nginx服务：

   ```bash
   # 在Ubuntu/Debian上
   sudo service nginx restart
   
   # 在CentOS/RHEL上
   sudo systemctl restart nginx
   ```

## 启动Node.js服务

在dist目录下启动Node.js服务：

```bash
# 使用pm2进程管理器（推荐）
npm install -g pm2
pm start # 或者直接执行 node app.js
```

## 环境变量配置

确保您的`.env`文件包含以下必要的环境变量：

```
QINIU_ACCESS_KEY=您的七牛云AccessKey
QINIU_SECRET_KEY=您的七牛云SecretKey
QINIU_BUCKET=您的七牛云存储空间名称
QINIU_DOMAIN=您的七牛云域名
PORT=3000 # Node.js服务端口
```

## 注意事项

1. 确保Nginx用户对dist目录有读取权限
2. 如果使用防火墙，确保80端口和3000端口已开放
3. 对于生产环境，建议配置HTTPS（可以使用Let's Encrypt免费证书）
4. 推荐使用进程管理器如pm2来管理Node.js服务，确保服务稳定运行

## 常见问题排查

1. 如果访问API时报错，检查Node.js服务是否正常运行
2. 如果静态文件无法加载，检查Nginx的root配置是否正确
3. 如果出现跨域问题，在Nginx配置中添加跨域头
