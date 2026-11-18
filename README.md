# 🎋 听雨 · 幽篁 (Zhuyu) - 3D 东方水墨禅意空间

> **“独坐幽篁里，弹琴复长啸。深林人不知，明月来相照。” —— 王维《竹里馆》**

「听雨 · 幽篁」是一个基于 **React 18、TypeScript、Three.js (@react-three/fiber / @react-three/drei)** 和原生 **Web Audio API** 构建的高沉浸度东方美学 3D Web 禅意空间。全景还原空山新雨、幽篁修竹、古亭抚琴、石涧流泉的古典文人意境。

---

## ✨ 核心特性

* **🏛️ 纯代码程序化古典听雨亭（Procedural Pavilion）**
  * 基于双檐歇山四角攒尖顶算法构建，还原真实中式木构出檐挑角、斗栱铺作、美人靠卷棚与木柱覆盆石础。
  * 采用 2K PBR 灰瓦与青石台阶贴图，屋顶无任何预制外部大模型，完全程序化动态三角面生成。
* **🎋 泊松圆盘自然竹林系统（Poisson Disk Sampling Bamboo Forest）**
  * 依托 Bridson 变半径泊松圆盘算法分布数百竿修竹，自然疏密起伏；
  * 严苛规划避让区域：听雨亭主体内部、迎客前坪、林间泥土小径全线**绝对净空**，杜绝穿模；
  * `InstancedMesh` 批量合批渲染，百万级竹叶面数保持 60 FPS 流畅帧率；
  * 支持在控制台实时微调竹林总株数、避让半径及密度倍率。
* **🕯️ 宋式文人案几与摇曳微光防风烛台**
  * 考据宋代文人雅室陈设，剔除突兀的现代电灯，替换为**宋式青铜长明防风烛台**；
  * 天然蜂蜡柱与双层有机微颤烛火，配以透光琉璃纱罩；
  * 案头陈列**宣德青铜小香炉、白瓷茶盏与可交互抚琴的古琴（五声音阶实时奏响）**。
* **🌧️ 纯原生 Web Audio 程序化声学合成引擎**
  * **零音频文件加载**：纯代码基于白噪声带通滤波、双二阶滤波与物理建模，动态合成真实细雨、流水声与檐角随机雨滴敲击声；
  * 随天气模式（微雨/细雨/暮雨）及镜头进出亭内（室内闷音滤波/室外通透）自动实现空间声学衰减；
  * 支持点击古琴弹奏中国传统五声音阶（宫、商、角、徵、羽）。
* **🎮 游戏级沉浸开篇加载幕（Loading Screen）**
  * 实时挂载 Three.js 资源加载流，展示典雅国风资源加载进度与平滑进度条；
  * “点击入境 · 抚琴听雨” 交互仪式，完美合规唤醒现代浏览器 Web Audio 自动发声。
* **⚙️ 云原生与一键容器化发版体系**
  * 完整的 `deploy/` 配置体系，支持环境变量驱动、SSH 连接复用（只需输 1 次密码）以及针对 3D 贴图的 Nginx 极致 Gzip 压缩与分级缓存。

---

## 📁 目录结构

```text
zhuyu/
├── deploy/                     # 🚀 容器化与服务器发版收拢目录
│   ├── .env.example            # 发版环境变量模版（端口、服务器 IP、目录）
│   ├── .env                    # 真实发版环境变量配置（已加入 .gitignore）
│   ├── Dockerfile              # 超轻量 Nginx Alpine 镜像构建
│   ├── docker-compose.yml      # Docker 服务编排配置
│   ├── nginx.conf              # 专为 3D WebGL / SPA 优化的 Nginx 配置
│   ├── deploy.sh               # 一键本地构建或远程同步部署脚本
│   └── README.md               # 部署模块独立说明
├── public/                     # 🎨 静态资源目录（规范化分类）
│   └── textures/
│       ├── bamboo/             # 竹竿与竹叶材质 (culm, foliage)
│       ├── ground/             # 山林湿土地表 (damp-soil)
│       ├── pavilion/           # 听雨亭 PBR 材质 (floor-*, roof-*)
│       └── rocks/              # 溪流青苔石与卵石 (moss-stone, river-stone)
├── src/
│   ├── components/
│   │   ├── 3d/                 # Three.js 3D 渲染组件
│   │   │   ├── BambooForest.tsx    # 泊松圆盘分布竹海
│   │   │   ├── CameraController.tsx# 多机位视角运镜平滑切换
│   │   │   ├── Environment.tsx     # 天光水墨雾气与环境光
│   │   │   ├── ForestGround.tsx    # 动态着色器湿润地表
│   │   │   ├── Pavilion.tsx        # 听雨亭案几陈设与案头微光
│   │   │   ├── ProceduralPavilion.tsx # 程序化歇山顶古亭几何结构
│   │   │   ├── RainSystem.tsx      # 动态雨丝与涟漪粒子
│   │   │   ├── Scene.tsx           # 主场景画布 Canvas
│   │   │   └── Stream.tsx          # 石涧流泉物理水体
│   │   └── ui/                 # 2D 交互界面
│   │       ├── Controls.tsx        # 交互栏与音频/天气切换
│   │       ├── LoadingScreen.tsx   # 游戏级开篇资源加载幕
│   │       ├── PoemOverlay.tsx     # 悬浮国风古典诗词卡片
│   │       └── SettingsPanel.tsx   # 境象参数调控抽屉面板
│   ├── stores/                 # Zustand 状态管理
│   ├── utils/                  # 数学、算法与程序化音频引擎
│   │   ├── audioSynthesizer.ts # Web Audio 原生声音物理合成器
│   │   ├── bambooLayout.ts     # 泊松圆盘变半径采样算法
│   │   └── terrain.ts          # 自然地形与水系高度场函数
│   ├── App.tsx
│   └── main.tsx
├── .gitignore
├── package.json
├── tailwind.config.js
└── vite.config.ts
```

---

## 🛠️ 本地开发运行

### 环境要求
* Node.js >= 18.0.0
* npm >= 9.0.0 (或 pnpm / yarn)

### 快速启动
```bash
# 1. 安装依赖
npm install

# 2. 启动本地开发服务 (支持 HMR 热更新)
npm run dev

# 3. 生产打包构建
npm run build
```

浏览器访问控制台提示的地址（默认 `http://localhost:5174/`）即可进入场景。

---

## 🚢 服务器发版与部署

项目已实现代码与环境配置解耦，发版资产全部收拢在 `deploy/` 中。

### 1. 配置部署参数
直接编辑 `deploy/.env`：
```ini
APP_NAME=zhuyu-zen
APP_PORT=8080                 # 宿主机对外映射访问端口

# 远程发版（选填）
SERVER_HOST=123.45.67.89      # 远程服务器 IP
SERVER_USER=root              # SSH 登录用户名
SERVER_SSH_PORT=22            # SSH 端口
SERVER_DIR=/opt/zhuyu-zen     # 远程部署路径
```

### 2. 执行一键发版
```bash
./deploy/deploy.sh
```
* **一键远程部署**：本地自动完成构建，通过 `rsync` 增量推送产物并远程拉起 Docker 服务（**支持 SSH ControlMaster，全流程仅需验证 1 次密码，阅后即焚自动销毁安全通道**）；
* **本地 Docker 运行**：若未填写 `SERVER_HOST`，将直接在本地电脑拉起容器供快速测试。

---

## ⚡ 性能调优指南

1. **贴图轻量化**：静态材质目录已全面瘦身至 54 MB，移除了 DirectX 法线与冗余置换贴图，首屏加载性能提升 60% 以上；
2. **GPU 实例化**：竹竿与竹叶全面使用 `THREE.InstancedMesh`，单次 Draw Call 绘制整片竹海；
3. **分级强缓存**：Nginx 对 `/assets/` 采用 1 年不可变强缓存 (`immutable`)，对 `/textures/` 采用 30 天缓存，`index.html` 实施 `no-cache` 保证发版即时生效。
