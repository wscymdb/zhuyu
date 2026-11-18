# 听雨·禅意 3D 空间 (Zhuyu) 服务器发版部署指南

本目录包含完整的 Docker 容器化与一键部署配置，实现了配置与代码的完全解耦。

---

## 目录结构

```text
deploy/
├── .env.example            # 环境变量模版（纳入版本库）
├── .env                    # 本地/服务器真实生效配置（端口、服务名、服务器 IP）
├── Dockerfile              # 超轻量 Nginx Alpine 镜像构建定义
├── docker-compose.yml      # Docker Compose 服务编排
├── nginx.conf              # 针对 3D WebGL / SPA 深度调优的 Nginx 配置
├── deploy.sh               # 一键自动化发版脚本（支持本地或远程）
└── README.md               # 部署说明文档
```

---

## 快速使用

### 1. 修改配置（可选）
直接编辑 `deploy/.env`：
```ini
APP_NAME=zhuyu-zen
APP_PORT=8080                # 对外映射端口（可改为 80、8080 等）

# 若需要一键发布到远程云服务器，填入以下参数：
SERVER_USER=root
SERVER_HOST=123.45.67.89     # 您的云服务器 IP
SERVER_DIR=/opt/zhuyu-zen    # 服务器目标部署路径
```

### 2. 执行一键发版
在项目根目录运行：
```bash
./deploy/deploy.sh
```
* 如果已填写 `SERVER_HOST`：脚本将自动执行本地生产打包（`npm run build`）并通过 `rsync` 增量推送产物至云服务器，远程执行 Docker Compose 启动。
* 如果未填写 `SERVER_HOST`：脚本会交互式询问是输入临时 IP 部署，还是直接在当前本地电脑 Docker 中拉起容器运行。

---

## Nginx 优化特性说明

本工程中的 `nginx.conf` 专为 3D WebGL 项目调优：
1. **Gzip 深度压缩**：针对大型 Three.js JS 脚本、JSON、WASM 开启 6 级压缩，减少 70% 传输体积。
2. **分级强缓存策略**：
   * 带 Hash 的编译脚本（`/assets/*`）设置 1 年强缓存 (`immutable`)；
   * 3D 材质贴图（`/textures/*`）设置 30 天长期缓存；
   * `index.html` 强制 `no-cache`，确保发版后用户刷新页面即刻加载最新版本。
3. **SPA 防 404 回退**：`try_files $uri $uri/ /index.html;` 保证用户在任何子路径刷新不报错。
