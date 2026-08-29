# Pinch

将公开的 Pinterest 视频 Pin 解析为可预览、可保存的 MP4。

[English](README.md) · [中文](README-CN.md) · [在线演示](https://ingeniousfrog.github.io/Pinch/)

![Pinch 界面：粘贴公开 Pinterest 链接并获取 MP4](assets/pinch.png)

Pinch 是一个纯静态前端工具：粘贴公开 Pin 链接，选取 Pinterest 暴露的最优渐进式 MP4。无账号、无上传、无分析统计，也不支持图板、个人页、图片或批量抓取。

## 功能概览

| 能力 | 说明 |
| --- | --- |
| 解析范围 | 公开 `pinterest.com/pin/<数字 ID>` 链接（含完整 `/sent/` 分享链接、常见子域与地区域名） |
| 媒体优先序 | 优先渐进式 MP4；检测到 HLS 但浏览器不可读时给出明确错误 |
| 下载策略 | 可读时直接 Blob 下载；跨域不可读时诚实提示「打开原片」 |
| 部署形态 | Vite 静态站点，可托管于 GitHub Pages，生产路径前缀 `/Pinch/` |
| 依赖与隐私 | 生产构建无运行时 npm 依赖；解析在浏览器内直连 Pinterest，不经中间服务器 |

## 使用方法

1. 打开 [在线演示](https://ingeniousfrog.github.io/Pinch/)，或本地启动开发服务。
2. 粘贴公开 Pin 链接，例如 `https://www.pinterest.com/pin/<numeric-id>/`；完整的 Pinterest `/sent/` 分享链接也可以直接使用。
3. 点击 **Get MP4**，预览解析到的最优渐进式源。
4. 按界面提示操作：
   - **Download MP4**：浏览器可读取原始字节并保存，无需转码。
   - **Open MP4**：当前源站无法跨域读取文件；在新标签打开后，请使用浏览器自带的保存功能。

「打开原片」不会被标记为下载成功。

## 支持与限制

**支持**

- 公开的 `pinterest.com/pin/<numeric-id>` URL
- 以 `/sent/` 结尾的完整 Pinterest 分享 URL（查询参数会被忽略）
- 普通子域（如 `www.pinterest.com`）与地区域名（如 `pinterest.co.uk`）
- Pinterest 视频 CDN（`v*.pinimg.com`）上的渐进式 MP4
- HLS 检测；在浏览器无法访问时返回明确的能力边界错误

**不支持**

- 自动解析 `pin.it` 短链；纯静态应用会改为提示用户打开短链，再复制完整的 `pinterest.com/pin/...` URL
- 私密 Pin、登录、Cookie 或账号体系
- 图板、个人页、图片、Feed、搜索与批量下载
- 任意 CORS 代理、第三方下载站或服务端中转
- DRM、访问控制绕过或限流规避

## 工作原理

```text
公开 Pin URL
  → 识别 pin.it 短链并说明纯静态应用的转换方法
  → 校验并提取数字 Pin ID
  → 请求 Pinterest 公开 widget JSON
  → 递归归一化支持的视频表示
  → 拒绝非 Pinterest 媒体 URL
  → 去重，并按 MP4 优先于 HLS 排序
  → 探测所选媒体在浏览器中是否可读
  → Blob 下载，或诚实引导打开原片
```

普通 Pin 页面虽含嵌入式 JSON，但不会向第三方源站开放响应体。静态解析器因此使用 Pinterest widget 机制背后的公开 JSON 接口：无需登录或密钥，但非官方稳定 API，故隔离在 `PinResolver` 之后，并以脱敏 fixture 覆盖。

提取器可识别嵌套 Story Pin、`video_list` / `videoList` / `videoUrls`、页面结构化 JSON 与 Open Graph 视频元数据。UI 仅消费归一化后的 `PinVideo` 与 `VideoSource`。

## 隐私与信任边界

- 解析由浏览器直接请求 Pinterest，不经 Pinch 应用服务器。
- 不存储视频内容；渐进式媒体字节不经过 Pinch 服务。
- 不请求、不保存 Pinterest 登录态、Cookie 或 API 凭证。
- 默认不包含分析与埋点。
- 生产构建无运行时 npm 依赖。

## 浏览器能力边界

针对公开视频 Pin，当前浏览器侧结论如下：

| 能力 | 结果 |
| --- | --- |
| 公开 widget JSON 解析 | 静态源站可跨域成功 |
| 渐进式 MP4 预览 | 可作为不透明跨域媒体播放 |
| MP4 `fetch()` / Blob 下载 | 受 Pinterest CDN CORS 限制 |
| 跨域 `download` 链接 | 通常打开媒体，而非触发文件下载 |
| HLS 播放列表与分片访问 | 受 Pinterest CDN CORS 限制 |
| 浏览器端 HLS → MP4 转封装 | 在 GitHub Pages 等静态部署下不可达 |

Service Worker、`mode: "no-cors"` 或 WebAssembly 媒体库无法把不可读的跨域响应变成可读。因此 Pinch 不内置闲置的 `ffmpeg.wasm` 等转封装依赖。

## 本地开发

环境要求：Node.js 24、npm。

```sh
npm ci
npm run dev
```

开发服务地址以终端输出为准。生产 `base` 为 `/Pinch/`，本地开发亦使用该路径前缀。

常用命令：

```sh
npm test                 # 确定性单元 / DOM 测试
npm run test:coverage    # 覆盖率（阈值 80%）
npm run typecheck
npm run build
npm run test:e2e         # Playwright（含可选 live 探测）
npm run verify           # typecheck + 覆盖率 + 生产构建
```

Live Playwright 用例依赖 Pinterest 线上行为，与默认单元测试分离。仓库不提交真实 Pin ID 与媒体 URL；本地可设置：

- `PINCH_LIVE_PIN_ID`
- `PINCH_LIVE_PIN_MP4_URL`
- `PINCH_LIVE_PIN_HLS_URL`
- 可选第二组：`PINCH_LIVE_PIN_2_*`

未配置时，相关 live 探测会自动跳过。

## GitHub Pages 部署

推送到 `main` 时，工作流 `.github/workflows/deploy-pages.yml` 会执行校验、构建 `dist/`，并通过官方 Pages Actions 发布。

首次部署：

1. 打开仓库 **Settings → Pages**
2. **Source** 选择 **GitHub Actions**
3. 推送到 `main`，或在 Actions 中手动运行 **Deploy GitHub Pages**

站点地址：https://ingeniousfrog.github.io/Pinch/

## 致谢

Pinch 为独立 TypeScript 实现。单 Pin 解析行为参考了 Lim Kok Hole 的 MIT 许可项目 [`pinterest-downloader`](https://github.com/limkokhole/pinterest-downloader)，尤其是嵌入式 Pin 对象、`videos.video_list`、Story Pin 结构以及渐进式画质选择。其图板 / 个人页 / 图片批量下载架构未移植。

## 免责声明

Pinch 为独立技术工具，与 Pinterest 无关联、未获其认可或赞助。用户须确保仅下载本人拥有或已获授权的内容，并遵守适用条款与法律法规。

采用 MIT 许可，详见 [LICENSE](LICENSE)。
