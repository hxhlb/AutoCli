# opencli-rs

AI 驱动的命令行工具 —— 将网站、桌面应用和本地工具统一转化为 CLI 接口。

这是 [OpenCLI](https://github.com/anthropics/opencli)（TypeScript）的 Rust 完整重写版，功能对等，性能大幅提升。

## 特性

- **55 个站点、333 个命令** —— 覆盖 Bilibili、Twitter、Reddit、知乎、小红书、YouTube、Hacker News 等
- **浏览器会话复用** —— 通过 Chrome 扩展复用已登录状态，无需管理 token
- **声明式 YAML Pipeline** —— 用 YAML 描述数据抓取流程，零代码新增适配器
- **AI 原生发现** —— `explore` 分析网站 API、`synthesize` 自动生成适配器、`cascade` 探测认证策略
- **外部 CLI 透传** —— 集成 GitHub CLI、Docker、Kubernetes 等工具
- **多格式输出** —— table、JSON、YAML、CSV、Markdown
- **单一二进制** —— 编译为 4MB 静态二进制，零运行时依赖

## 安装

### 从源码编译

```bash
git clone https://github.com/your-org/opencli-rs.git
cd opencli-rs
cargo build --release

# 二进制位于 target/release/opencli-rs
cp target/release/opencli-rs /usr/local/bin/
```

### 环境要求

- Rust 1.75+（编译）
- Chrome/Chromium + OpenCLI 扩展（浏览器命令需要）

## 快速开始

```bash
# 查看所有可用命令
opencli-rs --help

# 查看某个站点的命令
opencli-rs hackernews --help

# 获取 Hacker News 热门文章（公开 API，无需浏览器）
opencli-rs hackernews top --limit 10

# JSON 格式输出
opencli-rs hackernews top --limit 5 --format json

# 获取 Bilibili 热门视频（需要浏览器 + Cookie）
opencli-rs bilibili hot --limit 20

# 搜索 Twitter（需要浏览器 + 登录）
opencli-rs twitter search "rust lang" --limit 10

# 运行诊断
opencli-rs doctor

# 生成 Shell 补全
opencli-rs completion bash >> ~/.bashrc
opencli-rs completion zsh >> ~/.zshrc
opencli-rs completion fish > ~/.config/fish/completions/opencli-rs.fish
```

## AI 发现能力

```bash
# 探索网站 API
opencli-rs explore https://example.com

# 自动探测认证策略
opencli-rs cascade https://api.example.com/data

# 一键生成适配器
opencli-rs generate https://example.com --goal "hot posts"
```

## 外部 CLI 集成

已集成的外部工具（透传执行）：

| 工具 | 说明 |
|------|------|
| `gh` | GitHub CLI |
| `docker` | Docker CLI |
| `kubectl` | Kubernetes CLI |
| `obsidian` | Obsidian 笔记管理 |
| `readwise` | Readwise 阅读管理 |
| `gws` | Google Workspace CLI |

```bash
# 透传到 GitHub CLI
opencli-rs gh repo list

# 透传到 kubectl
opencli-rs kubectl get pods
```

## 输出格式

通过 `--format` 全局参数切换输出格式：

```bash
opencli-rs hackernews top --format table    # ASCII 表格（默认）
opencli-rs hackernews top --format json     # JSON
opencli-rs hackernews top --format yaml     # YAML
opencli-rs hackernews top --format csv      # CSV
opencli-rs hackernews top --format md       # Markdown 表格
```

## 认证策略

每个命令使用不同的认证策略：

| 策略 | 说明 | 是否需要浏览器 |
|------|------|--------------|
| `public` | 公开 API，无需认证 | 否 |
| `cookie` | 需要浏览器 Cookie | 是 |
| `header` | 需要特定请求头 | 是 |
| `intercept` | 需要拦截网络请求 | 是 |
| `ui` | 需要 UI 交互 | 是 |

## 自定义适配器

在 `~/.opencli-rs/adapters/` 下创建 YAML 文件即可添加自定义适配器：

```yaml
# ~/.opencli-rs/adapters/mysite/hot.yaml
site: mysite
name: hot
description: My site hot posts
strategy: public
browser: false

args:
  limit:
    type: int
    default: 20
    description: Number of items

columns: [rank, title, score]

pipeline:
  - fetch: https://api.mysite.com/hot
  - select: data.posts
  - map:
      rank: "${{ index + 1 }}"
      title: "${{ item.title }}"
      score: "${{ item.score }}"
  - limit: "${{ args.limit }}"
```

### Pipeline 步骤

| 步骤 | 功能 | 示例 |
|------|------|------|
| `fetch` | HTTP 请求 | `fetch: https://api.example.com/data` |
| `evaluate` | 浏览器中执行 JS | `evaluate: "document.title"` |
| `navigate` | 页面导航 | `navigate: https://example.com` |
| `click` | 点击元素 | `click: "#button"` |
| `type` | 输入文本 | `type: { selector: "#input", text: "hello" }` |
| `wait` | 等待 | `wait: 2000` |
| `select` | 选取嵌套数据 | `select: data.items` |
| `map` | 数据映射 | `map: { title: "${{ item.title }}" }` |
| `filter` | 数据过滤 | `filter: "item.score > 10"` |
| `sort` | 排序 | `sort: { by: score, order: desc }` |
| `limit` | 截断 | `limit: "${{ args.limit }}"` |
| `intercept` | 网络拦截 | `intercept: { pattern: "*/api/*" }` |
| `tap` | 状态管理桥接 | `tap: { action: "store.fetch", url: "*/api/*" }` |
| `download` | 下载 | `download: { type: media }` |

### 模板表达式

Pipeline 中使用 `${{ expression }}` 语法：

```yaml
# 变量访问
"${{ args.limit }}"
"${{ item.title }}"
"${{ index + 1 }}"

# 比较和逻辑
"${{ item.score > 10 }}"
"${{ item.title && !item.deleted }}"

# 三元表达式
"${{ item.active ? 'yes' : 'no' }}"

# 管道过滤器
"${{ item.title | truncate(30) }}"
"${{ item.tags | join(', ') }}"
"${{ item.name | lower | trim }}"

# 字符串插值
"https://api.com/${{ item.id }}.json"

# Fallback
"${{ item.subtitle || 'N/A' }}"

# 数学函数
"${{ Math.min(args.limit, 50) }}"
```

**内置过滤器（16 个）：** `default`, `join`, `upper`, `lower`, `trim`, `truncate`, `replace`, `keys`, `length`, `first`, `last`, `json`, `slugify`, `sanitize`, `ext`, `basename`

## 配置

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `OPENCLI_VERBOSE` | - | 启用详细输出 |
| `OPENCLI_DAEMON_PORT` | `19825` | Daemon 端口 |
| `OPENCLI_CDP_ENDPOINT` | - | CDP 直连端点（跳过 Daemon） |
| `OPENCLI_BROWSER_COMMAND_TIMEOUT` | `60` | 命令超时（秒） |
| `OPENCLI_BROWSER_CONNECT_TIMEOUT` | `30` | 浏览器连接超时（秒） |
| `OPENCLI_BROWSER_EXPLORE_TIMEOUT` | `120` | Explore 超时（秒） |

### 文件路径

| 路径 | 说明 |
|------|------|
| `~/.opencli-rs/adapters/` | 用户自定义适配器 |
| `~/.opencli-rs/plugins/` | 用户插件 |
| `~/.opencli-rs/external-clis.yaml` | 用户外部 CLI 注册表 |

## 架构

```
┌─────────────────────────────────────────────────────────────────┐
│                         用户 / AI Agent                         │
│                     opencli-rs <site> <command>                  │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                      CLI 层 (clap)                               │
│  main.rs → discovery → clap 动态子命令 → execution.rs            │
│  ┌───────────┐  ┌───────────────┐  ┌──────────────────┐        │
│  │ 内置命令   │  │ 站点适配器命令 │  │ 外部 CLI 透传     │        │
│  │ explore    │  │ bilibili hot  │  │ gh, docker, k8s  │        │
│  │ doctor     │  │ twitter feed  │  │                  │        │
│  └───────────┘  └───────┬───────┘  └──────────────────┘        │
└─────────────────────────┼───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                     执行引擎 (execution.rs)                      │
│               参数校验 → 能力路由 → 超时控制                      │
│                    ┌─────────┼─────────┐                        │
│                    ▼         ▼         ▼                        │
│              YAML Pipeline  Rust Func  External CLI              │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────────────────┐
│  Pipeline 引擎                        浏览器桥接                  │
│  ┌────────────┐                      ┌─────────────────────┐    │
│  │ fetch      │                      │ BrowserBridge       │    │
│  │ evaluate   │  ──── IPage ────▶    │ DaemonClient (HTTP) │    │
│  │ navigate   │                      │ CdpPage (WebSocket) │    │
│  │ map/filter │                      └──────────┬──────────┘    │
│  │ sort/limit │                                 │               │
│  │ intercept  │                      Daemon (axum:19825)        │
│  │ tap        │                        HTTP + WebSocket          │
│  └────────────┘                                 │               │
│                                                 ▼               │
│  表达式引擎 (pest)                    Chrome 扩展 (CDP)          │
│  ${{ expr | filter }}                 chrome.debugger API        │
└──────────────────────────────────────────────────────────────────┘
```

### Workspace 结构

```
opencli-rs/
├── crates/
│   ├── opencli-rs-core/        # 核心数据模型：Strategy, CliCommand, Registry, IPage trait, Error
│   ├── opencli-rs-pipeline/    # Pipeline 引擎：pest 表达式, 执行器, 14 种步骤
│   ├── opencli-rs-browser/     # 浏览器桥接：Daemon, DaemonPage, CdpPage, DOM helpers
│   ├── opencli-rs-output/      # 输出渲染：table, json, yaml, csv, markdown
│   ├── opencli-rs-discovery/   # 适配器发现：YAML 解析, build.rs 编译时嵌入
│   ├── opencli-rs-external/    # 外部 CLI：加载, 检测, 透传执行
│   ├── opencli-rs-ai/          # AI 能力：explore, synthesize, cascade, generate
│   └── opencli-rs-cli/         # CLI 入口：clap, 执行编排, doctor, completion
├── adapters/                   # 333 个 YAML 适配器定义
│   ├── hackernews/
│   ├── bilibili/
│   ├── twitter/
│   └── ...（55 个站点）
└── resources/
    └── external-clis.yaml      # 外部 CLI 注册表
```

### 相比 TypeScript 原版的改进

| 改进项 | 原版 (TypeScript) | opencli-rs (Rust) |
|--------|-------------------|-------------------|
| 分发方式 | Node.js + npm install (~100MB) | 单一二进制 (4.1MB) |
| 启动速度 | 读 manifest JSON → 解析 → 注册 | 编译时嵌入，零文件 I/O |
| 模板引擎 | JS eval (安全隐患) | pest PEG parser (类型安全) |
| 并发 fetch | 非浏览器模式 pool=5 | FuturesUnordered, 并发度 10 |
| 错误系统 | 单一 hint 字符串 | 结构化错误链 + 多条建议 |
| HTTP 连接 | 每次 new fetch | reqwest 连接池复用 |
| 内存安全 | GC | 所有权系统，零 GC 暂停 |

## 开发

```bash
# 构建
cargo build

# 测试（166 个测试）
cargo test --workspace

# Release 构建（启用 LTO，约 4MB）
cargo build --release

# 添加新适配器
# 1. 在 adapters/<site>/ 下创建 YAML 文件
# 2. 重新编译（build.rs 自动嵌入）
cargo build
```

## 支持的站点

<details>
<summary>展开查看全部 55 个站点</summary>

| 站点 | 命令数 | 策略 |
|------|--------|------|
| hackernews | 8 | public |
| bilibili | 12 | cookie |
| twitter | 24 | cookie/intercept |
| reddit | 15 | public/cookie |
| zhihu | 2 | cookie |
| xiaohongshu | 11 | cookie |
| douban | 7 | cookie |
| weibo | 2 | cookie |
| v2ex | 11 | public/cookie |
| bloomberg | 10 | cookie |
| youtube | 4 | cookie |
| wikipedia | 4 | public |
| google | 4 | public/cookie |
| facebook | 10 | cookie |
| instagram | 14 | cookie |
| tiktok | 15 | cookie |
| notion | 8 | ui |
| cursor | 12 | ui |
| chatgpt | 6 | public |
| stackoverflow | 4 | public |
| devto | 3 | public |
| lobsters | 4 | public |
| medium | 3 | cookie |
| substack | 3 | cookie |
| weread | 7 | cookie |
| xueqiu | 7 | cookie |
| boss | 14 | cookie |
| jike | 10 | cookie |
| 其他 27 个站点 | ... | ... |

</details>

## 许可证

Apache-2.0
