# PDFImgInserter

基于 `Tauri v2 + Rust + React + Tailwind CSS` 的桌面 PDF 图片批量插入工具。

核心能力：
- 在 PDF 中搜索指定文本
- 根据文本坐标、基础偏移和随机偏移计算图片落点
- 使用 `pdfium-render` 渲染预览与处理输出
- 通过 Tauri 命令和事件流进行批处理与实时日志展示

## 代码结构

```text
pdf-img-inserter/
├── src/                        # React 前端
│   ├── components/             # 预览、任务列表、配置、日志面板等 UI
│   ├── hooks/                  # 状态管理与 Tauri 事件订阅
│   ├── lib/                    # 前端类型与 Tauri 命令封装
│   └── App.tsx                 # 主工作台布局
├── src-tauri/
│   ├── src/
│   │   ├── config/             # TOML 配置加载、保存、校验
│   │   ├── coord/              # PDF/Web 坐标换算
│   │   ├── image/              # 图片预处理、缓存、预览缓存
│   │   ├── pdf/                # Pdfium 封装、文本搜索、插图与预览
│   │   ├── logging.rs          # tracing -> 前端日志桥接
│   │   └── lib.rs              # Tauri 命令、应用初始化、路径策略
│   ├── resources/pdfium/       # 打包进安装包的 Pdfium 动态库
│   ├── tests/                  # Rust 集成测试
│   ├── Cargo.toml
│   └── tauri.conf.json
├── public/                     # 静态资源
└── TESTS.md                    # 测试说明

```

## 运行环境

- Node.js 20+
- `pnpm`
- Rust stable
- Tauri v2 开发环境
- 可用的 Pdfium 动态库

当前仓库采用 Tauri `bundle.resources` 方案，开发和打包都会优先从：

- `src-tauri/resources/pdfium/`

加载 Pdfium。当前 macOS 开发使用的是：

- `src-tauri/resources/pdfium/libpdfium.dylib`

如果要在 Windows 或 Linux 上开发/打包：

- `pdfium.dll`
- `libpdfium.so`

## 如何运行

### 1. 安装依赖

```bash
pnpm install
```

### 2. 启动开发环境

```bash
pnpm tauri dev
```

这会同时启动：
- Vite 前端开发服务器
- Tauri 桌面壳
- Rust 后端

## 首次运行与默认配置

应用启动后，前端会先向后端请求默认配置文件路径，并尝试加载该配置；如果配置文件不存在或无法正常加载，就会自动创建一个新的默认配置文件，然后再次加载。

### 默认配置文件位置

默认配置不再放在仓库根目录，而是放在 Tauri 的应用配置目录中：

- 默认配置文件：`<app_config_dir>/config.toml`
- 默认输入目录：`<document_dir>/PDFImgInserter/input`
- 默认输出目录：`<document_dir>/PDFImgInserter/exports`

其中 `document_dir` 如果不可用，会依次回退到：

- 下载目录
- 用户 Home 目录

### 首次运行时会发生什么

如果默认配置文件缺失，应用会自动执行以下动作：

1. 创建应用配置目录、数据目录、缓存目录、日志目录。
2. 创建默认输入目录和默认输出目录。
3. 生成默认 `config.toml`。
4. 重新加载该配置，并作为当前工作配置使用。

如果发现旧版默认配置文件存在，应用会优先尝试迁移旧配置到新的应用配置目录。

如果默认配置文件存在但内容损坏：

- 会先备份为 `config.toml.broken-<timestamp>.bak`
- 然后重新生成新的默认配置

### 首次生成的默认配置内容

首次自动生成的默认配置是一个“空任务”配置，特点是：

- `global.inputFolder` 指向应用管理的默认输入目录
- `global.outputFolder` 指向应用管理的默认输出目录
- `tasks` 初始为空数组

示意如下：

```toml
[global]
inputFolder = "/Users/<you>/Documents/PDFImgInserter/input"
outputFolder = "/Users/<you>/Documents/PDFImgInserter/exports"

tasks = []
```

实际路径会根据当前操作系统和用户目录变化。

### 配置字段的默认值

除了“首次运行自动生成默认配置文件”之外，配置加载时本身也有字段级默认值。也就是说，如果某个已有配置文件缺少部分字段，反序列化时会按默认值补齐，再做路径解析和校验。

当前主要默认值包括：

- `global.inputFolder`: `./input_pdfs`
- `global.outputFolder`: `./output_pdfs`
- `task.baseOffsetX`: `0`
- `task.baseOffsetY`: `0`
- `task.randomOffsetX`: `0`
- `task.randomOffsetY`: `0`
- `task.targetHeightPoints`: `50.0`
- `task.enabled`: `true`
- `tasks`: 空数组

需要注意的是：

- “首次生成的默认配置文件”使用的是应用管理目录下的绝对路径
- “字段级默认值”主要用于加载不完整配置时的补齐，两者不是同一套逻辑

### 便携配置与默认配置的区别

如果你手动选择一个非应用管理目录下的 `config.toml` 并创建配置，应用会按该文件所在目录生成：

- `input_pdfs/`
- `output_pdfs/`

这类配置会优先以相对路径保存，便于连同配置文件一起移动；而应用自己的默认配置则使用绝对路径保存。

### 3. 常用检查命令

前端类型检查：

```bash
pnpm exec tsc --noEmit
```

Rust 编译检查：

```bash
cargo check --manifest-path src-tauri/Cargo.toml
```

Rust 测试：

```bash
cargo test --manifest-path src-tauri/Cargo.toml
```

### 4. 打包发布

```bash
pnpm tauri build
```

如果推送一个符合 `v*` 的 Git 标签，例如：

```bash
git tag v1.0.0
git push origin v1.0.0
```

GitHub Actions 会自动：

- 在 `ubuntu-22.04`、`windows-latest`、`macos-latest` 上构建安装包
- 创建或更新同名 GitHub Release（草稿）
- 由 GitHub 自动生成 Release Notes
- 将各平台安装包作为 Release assets 挂载到该 Release 下
