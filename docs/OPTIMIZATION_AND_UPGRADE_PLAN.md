# Nexus Video Platform — 界面板块梳理与优化/升级计划

## 一、项目与界面板块总览

### 1.1 技术架构概览

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        client-web (Vite + React 18)                     │
│  Tailwind v4 · i18n (zh/en) · PWA · Video.js · HLS · LiveKit · Three.js │
└─────────────────────────────────────────────────────────────────────────┘
                                      │
                          API Gateway (identity :8080)
                                      │
┌─────────────────────────────────────────────────────────────────────────┐
│  services: identity, payment, content, metadata, royalty, nft, live,    │
│  achievement, governance, bridge, transcode, search, moderation,        │
│  messaging, engagement (15 个微服务)                                     │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 前端路由与板块一览

| 板块 | 路径 | 页面组件 | 说明 |
|------|------|----------|------|
| **入口/首页** | `/` | 重定向 | 根据 dev 模式重定向到 `/home` 或 `/feed` |
| **首页（登录后）** | `/home` | Home | 搜索、Banner、继续观看、推荐/热门、创作者工作台、积分/交易、通知、任务/勋章、Live/音乐/文章 Widget |
| **发现流** | `/feed` | VideoFeed | 抖音式全屏竖屏流、上下滑动、评论/点赞/打赏、弹幕、HLS 播放 |
| **音乐** | `/music` | MusicFeed | 音乐内容流 |
| **阅读** | `/articles` | ArticleFeed | 文章流 |
| **发现/直播列表** | `/explore` | Explore | 直播房间列表、去开播 |
| **通知** | `/notifications` | Notifications | 站内通知列表 |
| **登录** | `/login` | Login | JoyID / 邮箱 / .bit / 钱包登录 |
| **视频列表** | `/videos` | VideoList | 视频列表、筛选、排序 |
| **播放页** | `/player/:id` | VideoPlayer | 单个视频播放、弹幕、评论、支付浮层、流支付展示 |
| **流支付演示** | `/stream-demo/:id` | StreamPaymentDemo | 流支付演示页 |
| **创作者上传** | `/creator/upload` | CreatorUpload | 视频上传（TUS/Base64）、元数据 |
| **个人中心** | `/user` | UserCenter | 用户信息、设备、设置入口 |
| **积分中心** | `/points` | PointsCenter | 积分余额、购买/兑换、CKB/Fiber、订单 |
| **直播频道** | `/live/@:username` | ChannelPage | 主播频道页 |
| **直播观看** | `/live/:roomId` | Live | 直播观看、礼物、弹幕、LiveKit |
| **开播/直播间** | `/room/create` | LiveStudio | 创建直播间 |
| **直播间工作室** | `/room/studio/:roomId` | LiveStudio | 直播间控制台 |
| **一起看** | `/watch-party` | WatchParty | 多人观影、3D 虚拟房间（Three.js） |
| **创作者 NFT** | `/creator/nft` | CreatorNFT | NFT 发行/管理 |
| **合集** | `/collection/:videoId` | VideoCollection | 视频合集 |
| **成就** | `/achievements` | Achievements | 成就徽章 |
| **任务** | `/tasks` | Tasks | 任务中心、签到、每日任务 |
| **幸运转盘** | `/wheel` | DailyWheel | 每日转盘抽奖 |
| **碎片画廊** | `/fragments` | FragmentGallery | 碎片/NFT 展示 |
| **关于** | `/about` | AboutNexus | 关于页 |
| **白皮书** | `/whitepaper` | Whitepaper | 白皮书 |
| **Magic Link** | `/magic-link` | MagicLink | 邮箱魔法链接回调 |
| **JoyID 移动回调** | `/joyid/mobile-callback` | MobileJoyID | JoyID 移动端回调 |
| **Twitter 回调** | `/auth/twitter/callback` | TwitterCallback | Twitter OAuth 回调 |
| **管理 CKB 订单** | (无公开入口) | AdminCkbOrders | 管理员 CKB 订单 |

### 1.3 全局 UI 结构

- **底部 Tab 栏（BottomTabBar）**：首页 / 发现 / 创作 / 我的；在 `/login`、`/feed`、`/player/*`、`/stream-demo/*` 隐藏。
- **顶部导航（TopNav）**：返回、标题、积分、通知、语言切换、Live 开播入口等；多页共用。
- **全局**：ErrorBoundary、Toast、PWA 更新提示、CCC 钱包 Provider、React Query。

### 1.4 后端服务与前端对应关系

| 服务 | 端口 | 前端主要使用 |
|------|------|--------------|
| identity | 8080 | 网关、登录、代理各服务 |
| payment | 8091 | 积分、购买、CKB、流支付、推荐奖励 |
| content | 8092 | 上传、HLS、继续观看 |
| metadata | 8093 | 视频元数据、推荐、弹幕、评论 |
| royalty | 8094 | 分成/版税 |
| nft | 8095 | NFT 相关 |
| live | 8096 | 直播房间、webhook、推流 |
| achievement | 8097 | 成就 |
| governance | 8098 | 治理 |
| bridge | 8099 | 多链桥 |
| transcode | 8100 | 转码、Livepeer/MinIO |
| search | 8101 | 搜索、Meilisearch |
| moderation | 8102 | 内容审核 |
| messaging | 8103 | 通知、ntfy |
| engagement | 8104 | 互动、推荐、任务等 |

---

## 二、优化计划（短期，不改变业务逻辑）

### 2.1 性能与加载

- **首屏与 Feed**  
  - 对 `/feed`、`/home` 的列表做虚拟列表或分页（如 react-window / 按需加载下一页），避免一次渲染大量 VideoCard。  
  - 图片统一使用懒加载 + 占位图，并考虑 CDN/压缩（如 WebP）。  
  - 保持现有路由级懒加载（VideoPlayer、VideoList 等已 lazy），确保未访问路由不进入首包。

- **Bundle**  
  - 将 `three`、`@react-three/fiber`、`@react-three/drei` 仅在使用 3D 的页面（如 WatchParty）做动态 import，减少主 bundle 体积。  
  - 检查 `video.js`、`hls.js` 是否可按路由拆分（仅 feed/player 使用）。  
  - 使用 `vite build --report` 或 rollup-plugin-visualizer 定位大模块并做 code-split。

- **接口与缓存**  
  - 对推荐、热门、直播列表等使用 React Query 或 SWR 的 staleTime，减少重复请求。  
  - 网关或前端对 GET 列表接口做短期缓存（如 30s）并统一错误重试策略。

### 2.2 体验与一致性

- **导航与反馈**  
  - 所有列表页和表单提交提供统一 loading 状态（骨架屏或顶部进度条）。  
  - 网络错误、鉴权失败时统一 Toast 或内联提示，避免静默失败。  
  - 底部 Tab 与 TopNav 的“当前页”高亮与路由严格一致（含子路径如 `/user` 下的子视图）。

- **无障碍与 SEO**  
  - 关键按钮、链接补充 `aria-label` 或可见文案。  
  - 播放器支持键盘快捷键（空格暂停、方向键 seek 等）。  
  - 重要页面（关于、白皮书、首页）保证服务端或预渲染时有可抓取的标题与描述。

- **多端**  
  - 在小屏下检查 Feed 全屏、弹幕、评论区是否可操作（触摸目标、滚动冲突）。  
  - 底部 Tab 在桌面端可保留为侧栏或顶部 Tab，避免与内容重叠（当前注释“桌面端隐藏”可改为响应式展示）。

### 2.3 代码与可维护性

- **样式**  
  - 将 `fun.css` 与 `index.css` 中重复的变量与工具类收口到 `index.css` 的单一 `:root`，避免两套命名（如 `--radius-*` 已在 index 定义，fun 仅引用）。  
  - 新组件优先使用 Tailwind 工具类，复杂动效再使用 CSS 文件或 CSS-in-JS。

- **请求与错误**  
  - 将 `ApiClient` 的 baseURL、JWT、错误处理封装成 React Context 或单例，避免各页面 `new ApiClient()` 再手动 setJWT。  
  - 对 401/403/5xx 做全局处理（如跳转登录、Toast），业务层只处理 4xx 业务错误。

- **类型与接口**  
  - 将 `VideoMeta`、`LiveRoom`、`PointsBalance` 等与后端一致的类型集中在 `shared`，避免页面内重复定义。  
  - 对 `/live/list`、`/metadata/recommendations` 等返回结构在 shared 中定义 DTO，便于前后端对齐。

### 2.4 安全与配置

- **环境变量**  
  - 所有 `VITE_*` 在 `.env.example` 中列出并注释用途，生产构建禁止使用 `.env.local`。  
  - 敏感操作（如 CKB 下单、流支付）前后做一次环境校验（如仅生产允许真实支付）。

- **依赖**  
  - 定期 `npm audit`，对 high/critical 制定修复或替换计划。  
  - 锁定 `three`、`video.js`、`@joyid/ckb` 等关键依赖的次版本，避免静默大版本升级。

---

## 三、升级计划（中期，功能与技术栈）

### 3.1 前端技术栈升级

- **React 与构建**  
  - 计划升级到 React 19（需评估 react-router-dom、react-query、各 UI 库兼容性）。  
  - Vite 保持 5.x，随官方升级小版本；评估 Vite 6 时间表后再升级。

- **状态与数据**  
  - 引入全局状态（如 Zustand 已有，可扩展）统一：用户信息、积分余额、未读通知数、当前播放进度等，减少 props 与 sessionStorage 分散读取。  
  - 将 React Query 从 v3 升级到 v5，并统一用于服务端状态（列表、详情、推荐）。

- **样式**  
  - 保持 Tailwind v4，将设计令牌（颜色、间距、圆角）全部收口到 `@theme` 与一份 `:root`，逐步去掉 fun.css 内重复变量。  
  - 考虑引入设计 Tokens 文件（如 JSON）供 Tailwind 与移动端共用。

### 3.2 功能增强（界面与板块）

- **首页 /home**  
  - 增加“最近观看”与“继续观看”的进度条与跳转续播。  
  - Banner 支持配置化（后端或 CMS），支持点击统计与 A/B。  
  - 创作者工作台入口与数据（上传数、转码中、7 日数据）与后端 API 完全对接。

- **发现流 /feed**  
  - 支持横向 Tab（推荐、关注、音乐、直播聚合）与后端 feed 接口对齐。  
  - 预加载下一则视频，减少滑动白屏。  
  - 评论/弹幕支持图片与@，敏感词过滤与后端 moderation 打通。

- **播放页 /player/:id**  
  - 清晰区分“免费试看 + 付费解锁”与“按分钟流支付”的展示与支付流程。  
  - 收藏/稍后观看与后端 API 打通。  
  - 倍速、画质、字幕（若有）持久化到本地偏好。

- **直播**  
  - 探索页直播列表支持按分类、人气、时间筛选。  
  - 直播间支持连麦、PK（若后端支持）。  
  - 礼物与打赏与支付服务打通，并支持排行榜与动画效果。

- **积分与支付**  
  - 积分中心支持历史流水筛选与导出。  
  - CKB/Fiber 支付状态轮询与到账回调在前端有明确状态与提示。  
  - 流支付演示页与真实流支付共用一套组件，仅通过配置切换环境。

- **创作者**  
  - 上传支持拖拽、多文件、进度与失败重试。  
  - 创作 NFT 与合集流程与 nft/ metadata 服务对齐，并支持预览与上架状态。

- **任务与成就**  
  - 任务中心与 engagement/achievement 服务完全对接，签到、每日任务、成就解锁有实时反馈与动效。  
  - 幸运转盘、碎片与后端规则一致，避免前后端规则不一致。

### 3.3 后端与运维

- **API 与网关**  
  - 为各服务定义 OpenAPI/Swagger，前端据此生成或校验类型。  
  - 网关层统一限流、请求 ID 与日志，便于排查问题。

- **监控与可观测**  
  - 各服务暴露 `/metrics`（Prometheus），与现有 Grafana 大盘对齐。  
  - 前端关键操作（播放、支付、登录）打点（如与现有 Prometheus/自定义后端对接），便于分析转化与异常。

- **部署与流水线**  
  - CI 中增加前端 lint、typecheck、单测与 E2E（Playwright 已有），通过后再构建镜像或发布。  
  - 部署流程中明确环境变量与密钥管理，避免硬编码。

### 3.4 产品与内容

- **多语言**  
  - 完善 i18n 键覆盖（含错误信息、空状态、引导文案），并保证 zh/en 与设计稿一致。  
  - 若有新语言，采用同一套 key 与命名空间。

- **内容与审核**  
  - 上传与发布前可选“仅自己可见/草稿”，与 metadata 状态机一致。  
  - 用户侧可见“审核中/未通过”状态与原因（若策略允许），与 moderation 服务打通。

- **搜索与推荐**  
  - 搜索页（或 TopNav 搜索）与 search 服务、Meilisearch 对接，支持建议词与历史。  
  - 推荐接口与 engagement 或独立推荐服务对齐，支持分页与刷新策略。

---

## 四、实施优先级建议

| 优先级 | 类别 | 项 | 说明 |
|--------|------|-----|------|
| P0 | 优化 | Feed/Home 列表虚拟化或分页 | 避免长列表卡顿与内存占用 |
| P0 | 优化 | 统一 ApiClient 与 401/5xx 处理 | 减少重复代码与静默失败 |
| P0 | 升级 | 各服务 `/metrics` 与 Grafana | 可观测性基础 |
| P1 | 优化 | 图片懒加载与占位 | 首屏与流内体验 |
| P1 | 优化 | three/video 按路由拆分 | 减小主 bundle |
| P1 | 升级 | React Query v5 + 服务端状态统一 | 缓存与请求策略一致 |
| P1 | 升级 | 推荐/任务/成就与后端完全对接 | 功能闭环 |
| P2 | 优化 | 无障碍与键盘快捷键 | 可用性与合规 |
| P2 | 升级 | 设计 Tokens 与样式收口 | 长期可维护 |
| P2 | 升级 | OpenAPI + 前端类型生成 | 接口契约清晰 |

---

## 五、文档与约定

- **路由**：新增页面请在 `main.tsx` 的 `<Routes>` 中注册，并在本表“路由与板块”中补充一行。  
- **环境变量**：所有 `VITE_*` 在 `.env.example` 中说明。  
- **接口**：新接口在 shared 中补充类型或 DTO，并在本文档或接口文档中注明对应服务与路径。  
- **设计**：新组件优先使用 `index.css` 的 `:root` 与 Tailwind 工具类，避免在页面内写死颜色与间距。

以上计划不改变现有业务逻辑，仅从性能、体验、可维护性与技术债角度给出优化与升级路径，可按优先级分阶段实施。
