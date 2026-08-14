# 套图管理器

基于 Node.js 的 Web 套图管理器，可浏览映射目录中的图片套图（文件夹与 zip/rar 压缩包），提供登录认证、目录树浏览、缩略图宫格与全屏原图查看。封装为 Docker 容器。

## 功能特性

1. **Web 管理 + 登录认证**：默认管理员账号 `admin` / 密码 `admin`（首次启动写入 `data/users.json`，可改密码）
2. **映射目录管理**：通过环境变量指定根目录，每个子目录即一个套图集合，可包含多个子文件夹与压缩包
3. **左侧目录树 + 右侧浏览区**：点击左侧目录，右侧展示其中套图与图片
4. **压缩包浏览**：支持 `.zip`（adm-zip 纯 JS）与 `.rar`（libarchive `bsdtar`）
5. **主流图片格式**：JPG/PNG/GIF/WebP/BMP/TIFF/AVIF/SVG/ICO/HEIC 等
6. **宫格缩略图**：进入目录时刷新缩略图（sharp 生成 WebP 缓存），点击图片全屏查看原图，支持左右键切换

## 快速开始（Docker Compose）

```bash
# 1. 准备图片目录（放置套图）
mkdir -p /data/pictures

# 2. 启动（默认 admin/admin，根目录 /data/pictures）
GALLERY_DIR=/data/pictures docker compose up -d

# 3. 打开 http://localhost:8080
```

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `8080` | 服务端口 |
| `GALLERY_ROOT` | `/gallery` | 图片映射根目录 |
| `ADMIN_USER` | `admin` | 默认管理员用户名 |
| `ADMIN_PASSWORD` | `admin` | 默认管理员密码 |
| `SESSION_SECRET` | 随机生成 | 会话签名密钥 |
| `THUMB_DIR` | `/app/data/thumbs` | 缩略图缓存目录 |

## 手动构建运行

```bash
docker build -t gallery-manager .
docker run -d -p 8080:8080 \
  -e GALLERY_ROOT=/gallery \
  -v /data/pictures:/gallery \
  -v gallery-data:/app/data \
  gallery-manager
```

## 本地开发

```bash
npm install
GALLERY_ROOT=./gallery PORT=8080 npm start
```

## 说明

- 首次启动会根据 `ADMIN_USER`/`ADMIN_PASSWORD` 创建管理员账号并 bcrypt 加密存储于 `data/users.json`，后续修改环境变量不会覆盖已有账号
- rar 浏览依赖容器内的 `bsdtar`（libarchive），宿主机直接运行时需自行安装 `libarchive-tools`
- 缩略图按 文件路径+大小+修改时间 生成缓存键，自动失效
