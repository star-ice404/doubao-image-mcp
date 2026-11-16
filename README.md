# doubao-image-mcp

通过浏览器自动化，将豆包网页版生图封装成 MCP 服务，支持 **参考图上传、Seedream 模型选择、自动或自定义比例、本地图片下载**。

使用 Playwright 连接本机 Chrome 调试会话，通过官方 MCP SDK 提供 stdio 工具。独立非官方项目，与豆包、字节跳动或 DeepSeek 无隶属关系。

## 功能

- `doubao_status`：检查浏览器连接、登录/验证码状态。
- `doubao_generate_image`：一次提交生成请求，返回本地图片、实际尺寸和对话地址。
- 网页菜单选择模型，同时发送结构化文本：`请使用seedream4.5生成一张9:16的图片：提示词`。
- 单进程排队、跨进程锁；已提交请求不自动重发，不静默切换模型。
- 失败时保留本地诊断，便于网页改版后更新选择器。

## 模型

| MCP 参数 | 网页名称 |
| --- | --- |
| `seedream5.5` | Seedream 5.5 |
| `seedream5.0fast` | Seedream 5.0 Flash |
| `seedream4.5` | Seedream 4.5 |
| `seedream4.0` | Seedream 4.0 |
| `seedream5.0Pro` | Seedream 5.0 Pro，会员模型，需 `allow_pro: true` |

默认 `seedream5.5`。实际可用模型和额度取决于登录账号及网页；缺少对应菜单时返回 `MODEL_UNAVAILABLE`。1.1.0 已修正早期 Pro 参数拼写；旧拼写不再接受。

## 环境与安装

- Node.js **22+**，npm。
- 已安装 Chrome/Chromium，以及本机可连接的 CDP 调试会话。
- 已登录豆包网页账号；生图可能消耗账号额度。
- 使用 DeepSeek Harness 的 ego 浏览器最方便，但 MCP 本身不依赖 Harness 私有 API。

下载本仓库后：

```sh
cd doubao-image-mcp
npm ci
npm test
```

### 方式 A：复用 Harness ego 浏览器

在 Harness 调用 `ego_status` 启动浏览器，在浏览器打开豆包并登录。服务自动从 ego 状态文件读取调试端口。

默认路径：

- Windows：`%LOCALAPPDATA%/ego-lite-linux/browser.json`
- Linux/macOS：`${XDG_STATE_HOME:-$HOME/.local/state}/ego-lite-linux/browser.json`

若所装 ego 版本路径不同，设置 `DOUBAO_BROWSER_STATE`。服务仅读取状态中的端口，不导出 Cookie。

`npm run setup` 可尝试调用本机桌面 profile 的 ego runtime；其他安装位置设置 `DOUBAO_EGO_CLI`。实际登录仍在浏览器完成。

### 方式 B：指定本机 Chrome 调试端口

使用**独立、专用的浏览器资料目录**启动 Chrome，示例：

```sh
# Linux 示例；Chrome 可执行文件名称按本机安装修改
chromium --remote-debugging-port=9222 --user-data-dir=/tmp/doubao-mcp-profile https://www.doubao.com/chat/
```

Windows 可在终端调用 Chrome 的完整可执行文件路径，并设置同样的两个启动参数。登录后，将 MCP 环境变量设置为：

```text
DOUBAO_CDP_URL=http://127.0.0.1:9222
```

只接受 loopback 地址。不要将调试端口开放到公网，也不要把浏览器资料目录加入仓库。

### 环境变量

| 变量 | 用途 |
| --- | --- |
| `DOUBAO_CDP_URL` | 显式指定本机 Chrome CDP 地址，优先于状态文件 |
| `DOUBAO_BROWSER_STATE` | 自定义 ego browser.json 绝对路径 |
| `DOUBAO_EGO_CLI` | `npm run setup` 使用的 ego-browser.mjs 路径 |
| `DSH_HOME` | `setup` 查找桌面 ego runtime 时的 Harness 用户目录 |

## 接入 DeepSeek Harness

复制仓库中的 `harness.cordis.yml`，把 `/ABSOLUTE/PATH/doubao-image-mcp` 替换为本机真实目录，Windows 也可用正斜杠。确保 `node` 在 Harness 的 PATH 中，或填写其完整路径。

```yaml
- insert:
    - id: doubao-image-mcp
      name: '@deepseek-ai/dsh-mcp-client'
      config:
        serverName: doubao
        transport: stdio
        command: node
        args:
          - '/ABSOLUTE/PATH/doubao-image-mcp/src/server.mjs'
        cwd: '/ABSOLUTE/PATH/doubao-image-mcp'
        env: {}
        toolCallTimeoutMs: 960000
        startupTimeoutMs: 30000
```

按 Harness 支持的方式加载 overlay，或把独立 `insert` 项合并进所用 profile 的 patch 层；保留已有配置。不要重复注册 `doubao` 名称。等待工具发现后，模型可调用：

```text
mcp__doubao__doubao_status
mcp__doubao__doubao_generate_image
```

通用 MCP 客户端参照 `mcp.json`，修改绝对路径后导入。它启动的是 `node src/server.mjs`，无需独立 HTTP 服务。`npm start` 会等待 MCP JSON-RPC 输入，stdout 专用于协议。

## 调用示例

```json
{
  "prompt": "电影质感火山喷发图片",
  "model": "seedream5.0fast",
  "aspect_ratio": "9:16",
  "timeout_seconds": 300
}
```

参考图与会员模型：

```json
{
  "prompt": "参考图片中的角色，绘制二头身Q版全身形象",
  "model": "seedream5.0Pro",
  "allow_pro": true,
  "aspect_ratio": "auto",
  "reference_images": ["/ABSOLUTE/PATH/reference.png"]
}
```

Windows 路径在 JSON 中需转义反斜杠，也可使用 `C:/images/reference.png`。仅 `prompt` 必填。

| 参数 | 说明 |
| --- | --- |
| `prompt` | 1..12000 字符 |
| `model` | 上表之一，默认 `seedream5.5` |
| `aspect_ratio` | 默认 `auto`；支持任意正数 `宽:高`，如 `21:9`、`2.35:1`，中文冒号可归一化 |
| `reference_images` | 最多10个本机绝对路径；PNG/JPEG/WebP/APNG，每张1..30MB；还受网页限制 |
| `timeout_seconds` | 30..900，默认300；网页操作另有阶段超时，此字段不是严格实时终止保证 |
| `output_dir` | 可选绝对路径，默认项目 `outputs/`；每次请求独立 UUID 子目录 |
| `allow_pro` | 默认false，请求会员模型时显式设true |

自定义比例以文本传给豆包，**不是强制裁切尺寸**。实际宽高在返回 `images[].width/height` 中；网页可能采用近似比例。

## 返回与故障处理

成功包含：`conversation_url`、`requested_model`、`selected_ui_model`、`available_ui_models`、`requested_aspect_ratio`、`sent_text`、`images[]`（本地path、URL、宽高、类型、字节数）、网页reply和耗时。图片及 `result.json` 保存在本机。

失败包含错误code、stage、submitted和diagnostic_dir；可写入 `error.json` 和诊断截图。它们可能含私密提示词与路径，分享前请脱敏。

- `BROWSER_NOT_RUNNING`：先启动浏览器，核对CDP或状态文件。
- `HUMAN_REQUIRED`：在真实浏览器完成登录/验证码；已提交时先查看原对话。
- `MODEL_UNAVAILABLE`：账号或网页缺少所选模型。
- `PRO_CONFIRMATION_REQUIRED`：会员模型需 `allow_pro: true`。
- `BUSY`：另一实例持有锁，稍后重试；异常终止残留锁时，先核对锁中进程已退出再删除。
- `SUBMISSION_FAILED` / `GENERATION_FAILED` / `TIMEOUT`：先检查返回对话，避免重复提交。
- `UI_CHANGED`：网页改版，需要更新定位并重新验证。

## 本地开发与验证

```sh
npm test
node scripts/verify-harness.mjs
npm run release:check
npm pack --dry-run
```

自动测试不联网生成，不依赖登录，不消耗生图额度。CI 配置覆盖 Windows/Linux/macOS、Node 22/24；配置存在不表示远端 CI 已执行。

实际浏览器验收目前来自 Windows + Chrome：普通文生图、参考图改图、Flash模型选择、9:16和2.35:1均成功。5.0 Pro的命名/菜单匹配已修正，会员生图尚未验收；Linux/macOS尚无真实浏览器端到端验收。网页控件与输出可能变化。

## 开源发布

采用 **MIT** 许可证，见 `LICENSE`。依赖许可见 `NOTICE`。参考图、生成图片及第三方服务不随代码许可证一并授权。

请从白名单创建干净的发行目录，而不是直接上传运行中的工作目录：

```sh
npm test
npm run release:check
npm run release:stage
```

结果位于 `dist/doubao-image-mcp-1.1.0-source/`，包含源码、测试、配置、文档、CI和SHA256校验清单。它排除运行结果、用户参考图、浏览器资料、依赖目录和本机诊断脚本。

在该**干净目录**初始化仓库，再上传到你选定的仓库；仓库和署名由维护者确定。尚未替你创建公共仓库或推送代码。`package.json` 保留 `private:true`，防止误发npm；GitHub开源不受此设置影响。若日后发布npm，先确认包名、仓库信息、维护者账号与双因素登录，再移除该标记并执行发布。

发布检查使用白名单及常见私密信息模式，不替代维护者对新增文件的人工审阅。请勿直接上传历史原型压缩包。
