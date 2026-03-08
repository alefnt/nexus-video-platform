# Nexus Video Platform — 细致全面优化与升级路线图

本文档在《界面板块梳理与优化/升级计划》基础上，给出**接下来所有**待办项的细致、全面清单，便于按阶段执行与验收。  
**已完成的项**在第一节简要列出；**未完成项**按类别拆解为可执行任务，并标注建议优先级与涉及文件/接口。

---

## 一、已完成项（截至当前）

| 类别 | 已完成内容 |
|------|------------|
| **API 与错误** | 统一 `getApiClient()` 单例；401 自动清会话并跳转登录；5xx 派发 `api:serverError` 由 GlobalToast 展示；全站（除测试）已迁移至 `getApiClient()` |
| **列表与加载** | Home 推荐/热门「加载更多」+ 首屏 8 条；Feed 首屏 20 条；Home 推荐/热门、Explore 直播列表使用 React Query（useRecommendations/useTrending/useLiveList） |
| **图片** | `LazyImage` 组件（loading="lazy" + 占位）；VideoCard 封面与头像使用 LazyImage |
| **Bundle** | WatchParty 已 lazy，three/drei 随路由拆分 |
| **可观测** | identity、payment、content、metadata、search、transcode、messaging、moderation、royalty、live、achievement、governance、bridge、engagement、nft 暴露 `/metrics`；`docs/METRICS_AND_GRAFANA.md` 与 Prometheus 示例 |
| **区块链** | `docs/BLOCKCHAIN_INTEGRATION.md`；JoyID/CCC 登录与 CKB 支付流程按文档对齐；Fiber 注释与 env 说明 |
| **前端体验** | F15 骨架屏（SkeletonCard + Home/Explore）；F18 Tab 高亮与子路径（/user、/creator）；F20 关键按钮 aria-label（BottomTabBar、TopNav、播放器区域）；F21 播放器键盘（Space/M/F/左右箭头）；F16 表单提交态（Login、PaymentOverlay 等 disabled/loading） |
| **前端性能** | F1 Feed 仅挂载当前±1 条并 dispose 其余播放器；F5 HeroCarousel 使用 LazyImage；F11 Home 其余接口接入 React Query（points、continue、watchlist、purchases、creatorStats、notifications 等）；F26 fun.css 变量收口至 index.css |
| **共享类型** | F29/F30 shared DTO：RecommendationsResponse、TrendingResponse、LiveRoom |
| **配置** | F35 根目录与 client-web 的 .env.example 补全（VITE_* 等） |
| **列表分页** | F2 VideoList 分页（PAGE_SIZE=20 + "Load More"）；F3 Home 继续观看限 3 条 + "View All"；F4 MusicFeed/ArticleFeed 分页（PAGE_SIZE=20 + "Load More" + 筛选重置） |
| **React Query** | F13 积分/任务/成就/权益 hooks（useTaskList/useAchievements/useTransactions/useEntitlements）；F14 统一错误重试（401 不重试 + 指数退避）；F39 main.tsx QueryClient 全局 retry/retryDelay 配置 |
| **Bundle** | F8 rollup-plugin-visualizer 集成（ANALYZE=1）；F9 manualChunks 拆分 video.js/hls.js/framer-motion/three/livekit |
| **体验增强** | F16 PointsCenter/Tasks 表单提交态（disabled + "Processing..."）；F17 RouteProgressBar 顶部路由进度条；F24 Feed dragMomentum=false 防止过度滚动 |
| **继续观看** | P3 继续观看闭环：Home→/player/{id}?t={sec} 恢复播放位置；VideoPlayer 读取 ?t= 并 seekTo |
| **会话管理** | F43 Zustand useSessionStore（jwt/user/login/logout/hydrate） |
| **国际化** | P1 新增 points/achievements/upload i18n key（中英文） |
| **后端** | B1 docs/API_REFERENCE.md（各服务接口文档）；B2 网关 X-Request-Id（identity 生成/传播/response） |
| **DevOps** | D1 .github/workflows/ci.yml（lint/typecheck/build）；D3 docs/ENVIRONMENT_AND_SECRETS.md（环境变量文档 + 密钥管理 + 本地开发指南） |
| **工具** | F6 shared/utils/cdn.ts（getCoverUrl 工具函数）；F10 Profile 页面 lazy load + /profile/:address 路由 |

---

## 二、前端 — 性能与加载

### 2.1 列表与虚拟化

| 序号 | 任务 | 说明 | 涉及文件 | 优先级 |
|------|------|------|----------|--------|
| F1 | Feed 仅挂载当前±1 条 | 只渲染 currentIndex-1/currentIndex/currentIndex+1 三个 slide，其余用占位或空 div，减少 DOM 与 video.js 实例 | `client-web/src/pages/VideoFeed.tsx` | P1 |
| F2 | VideoList 分页 | 列表分页（pageSize=20），支持「加载更多」或页码；接口若暂无 cursor，可前端 slice 或后端加 `?page=&limit=` | `client-web/src/pages/VideoList.tsx`、metadata 或网关 | P1 |
| F3 | Home 继续观看/清单 | 若数据量大，仅首屏展示前 N 条，其余折叠或「查看更多」 | `client-web/src/pages/Home.tsx` | P2 |
| F4 | 音乐/文章流 | MusicFeed、ArticleFeed 列表做分页或懒加载，避免一次请求过多 | `client-web/src/pages/MusicFeed.tsx`、`ArticleFeed.tsx` | P2 |

### 2.2 图片与媒体

| 序号 | 任务 | 说明 | 涉及文件 | 优先级 |
|------|------|------|----------|--------|
| F5 | 全站图片统一 LazyImage | 所有 `<img>` 及背景图改为 LazyImage 或 loading="lazy"，优先覆盖列表卡片、头像、Banner | 各页面/组件（HeroCarousel、BentoGrid、Explore 卡片等） | P1 |
| F6 | 封面图 CDN/格式 | 若有 CDN，封面 URL 走 CDN；可选 WebP 或响应式 srcset | 配置或 `shared` 中 URL 拼接工具 | P2 |
| F7 | 播放器海报懒加载 | 播放页 poster 使用 LazyImage 或懒加载，避免阻塞首屏 | `client-web/src/pages/VideoPlayer.tsx`、`VideoFeed.tsx` | P2 |

### 2.3 Bundle 与代码拆分

| 序号 | 任务 | 说明 | 涉及文件 | 优先级 |
|------|------|------|----------|--------|
| F8 | 分析产物体积 | `vite build` 后使用 rollup-plugin-visualizer 或 `vite build --report`，产出分析报告并记录大模块 | `client-web/vite.config.ts`、根 package 脚本 | P1 |
| F9 | video.js / hls.js 按路由拆 | 仅 Feed、Player、StreamPaymentDemo、WatchParty 等需要播放的页面动态 import video.js/hls.js，避免首包包含 | `client-web/src/main.tsx`、各播放页 | P1 |
| F10 | 大依赖动态 import | 确认 framer-motion、@livekit/*、wagmi/viem 等仅在需要的路由或组件内按需加载 | 各页面 entry、lazy 路由 | P2 |

### 2.4 接口与缓存

| 序号 | 任务 | 说明 | 涉及文件 | 优先级 |
|------|------|------|----------|--------|
| F11 | Home 其余接口接入 React Query | 继续观看、watchlist、purchases、points、notifications、banners、creator/stats 等用 useQuery，统一 staleTime/retry | `client-web/src/pages/Home.tsx`、`hooks/useApi.ts` | P1 |
| F12 | 播放页详情与权益 | 视频详情、权益、评论用 useQuery/useMutation，带 key 与 invalidation | `client-web/src/pages/VideoPlayer.tsx`、hooks | P1 |
| F13 | 积分中心/任务/成就 | 积分、任务列表、成就列表用 React Query，避免重复请求 | `PointsCenter.tsx`、`Tasks.tsx`、`Achievements.tsx` | P2 |
| F14 | 统一错误重试 | 在 React Query 的 defaultOptions 或 per-query 中统一 retry 次数、retryDelay，对 401 不重试（已由 getApiClient 处理） | `client-web/src/main.tsx`、`useApi.ts` | P2 |

---

## 三、前端 — 体验与一致性

### 3.1 加载与反馈

| 序号 | 任务 | 说明 | 涉及文件 | 优先级 |
|------|------|------|----------|--------|
| F15 | 全局列表骨架屏 | 为 Home 各 section、VideoList、Explore、Feed 等提供统一骨架组件（如 SkeletonCard），数据加载中显示 | 新建 `components/ui/SkeletonCard.tsx` 等，各列表页 | P1 |
| F16 | 表单提交态 | 所有表单（登录、上传、支付确认、任务领取等）提交中显示 loading、禁用按钮，防止重复提交 | 各表单页、PaymentOverlay、PointsCenter 等 | P1 |
| F17 | 顶部进度条 | 路由切换或主要请求时显示顶部细条进度（如 nprogress 或自研），提升感知性能 | `client-web/src` 路由或 Api 层 | P2 |

### 3.2 导航与路由

| 序号 | 任务 | 说明 | 涉及文件 | 优先级 |
|------|------|------|----------|--------|
| F18 | Tab 高亮与子路径 | 当前路径为 `/user`、`/user/settings` 等时，「我的」Tab 正确高亮；`/creator/upload` 与「创作」一致 | `client-web/src/components/BottomTabBar.tsx` | P1 |
| F19 | 桌面端 Tab 展示 | 桌面端不隐藏底部 Tab，改为侧栏或顶部 Tab 展示，避免与内容重叠；或保留隐藏但文档说明 | `BottomTabBar.tsx`、相关 CSS | P2 |

### 3.3 无障碍（a11y）

| 序号 | 任务 | 说明 | 涉及文件 | 优先级 |
|------|------|------|----------|--------|
| F20 | 关键按钮 aria-label | 所有仅图标的按钮（播放/暂停、静音、全屏、关闭、Tab 图标等）补充 `aria-label` 或可见文案 | 各组件（VideoJS、VideoFeed、BottomTabBar、TopNav、PaymentOverlay 等） | P1 |
| F21 | 播放器键盘 | 空格暂停/播放，左右键 seek，M 静音，F 全屏；焦点在播放器时生效，避免与全局快捷键冲突 | `VideoPlayer.tsx`、`VideoFeed.tsx`、VideoJS 包装 | P1 |
| F22 | 焦点与焦点陷阱 | 弹窗打开时焦点移入、关闭时还原；Esc 关闭弹窗 | PaymentModal、StreamPaymentModal、各类 Modal | P2 |
| F23 | 色彩对比 | 确保主要文案、按钮与背景对比度满足 WCAG AA（可工具检测） | `index.css`、`fun.css`、各组件 | P2 |

### 3.4 多端与响应式

| 序号 | 任务 | 说明 | 涉及文件 | 优先级 |
|------|------|------|----------|--------|
| F24 | Feed 触摸与滚动 | 小屏下全屏 Feed 无滚动穿透；弹幕、评论区触摸目标≥44px；双指不误触 | `VideoFeed.tsx`、`video-feed.css`、弹幕/评论组件 | P1 |
| F25 | 播放器移动端 | 全屏、画质、倍速等控件在小屏下可点击且不遮挡内容 | `VideoPlayer.tsx`、播放器相关 CSS | P2 |

---

## 四、前端 — 代码与可维护性

### 4.1 样式收口

| 序号 | 任务 | 说明 | 涉及文件 | 优先级 |
|------|------|------|----------|--------|
| F26 | fun.css 变量收口到 index | `fun.css` 中 `--radius-*`、`--font-*` 等改为引用 `index.css` 的 `:root` 或 `@theme`，删除重复定义 | `client-web/src/styles/fun.css`、`index.css` | P1 |
| F27 | 去除内联颜色/间距 | 各页面中硬编码的 `#fff`、`rgba(...)`、`margin: 24` 等逐步改为 CSS 变量或 Tailwind 类 | 全站组件/页面 | P2 |
| F28 | 设计 Tokens 文档 | 在 `index.css` 或单独 tokens 文件中集中列出颜色、间距、圆角、阴影，并写简短说明供设计/多端对齐 | `docs/` 或 `client-web/src/design-tokens.css` | P2 |

### 4.2 类型与接口

| 序号 | 任务 | 说明 | 涉及文件 | 优先级 |
|------|------|------|----------|--------|
| F29 | LiveRoom 等 DTO 入 shared | 将 `Explore`、`Live`、`ChannelPage` 等中的 `LiveRoom` 接口移至 `shared/types`，与后端响应一致 | `shared/types/index.ts`、各页面 | P1 |
| F30 | 推荐/热门/列表响应类型 | `/metadata/recommendations`、`/metadata/trending`、`/metadata/list` 等返回结构在 shared 中定义，前端 useApi 使用 | `shared/types`、`useApi.ts` | P1 |
| F31 | 支付/积分相关类型 | CkbPurchaseIntent、Fiber 发票、积分流水等请求/响应类型统一在 shared，避免各处手写 | `shared/types`、`shared/validation/schemas.ts` | P2 |

### 4.3 测试与质量

| 序号 | 任务 | 说明 | 涉及文件 | 优先级 |
|------|------|------|----------|--------|
| F32 | E2E 关键路径 | Playwright 覆盖：登录 → 首页 → 播放 → 积分页（或支付占位）；CI 中可只跑 smoke | `tests/e2e/`、根 package scripts | P1 |
| F33 | 单测 getApiClient | 测试中 mock `getApiClient`，验证 401 时清会话/跳转、5xx 时派发事件 | `client-web/src/__tests__/` | P2 |
| F34 | 核心 hooks 单测 | useApi（useRecommendations 等）、useVideoEntitlement、useStreamMeter 等加单测 | `client-web/src/hooks/`、`__tests__/` | P2 |

---

## 五、前端 — 安全与配置

| 序号 | 任务 | 说明 | 涉及文件 | 优先级 |
|------|------|------|----------|--------|
| F35 | .env.example 完整 | 列出所有 `VITE_*`、`VITE_API_GATEWAY_URL`、`VITE_JOYID_APP_URL` 等并注释用途与示例值 | 根与 `client-web/.env.example` | P1 |
| F36 | 生产禁用 .env.local | 构建脚本或 CI 中检查生产构建不读取 `.env.local`，避免本地密钥泄露 | 根与 client-web 的 build 脚本、CI 配置 | P2 |
| F37 | 敏感操作环境校验 | CKB 下单、流支付等仅在非 dev 或显式配置下允许真实支付；dev 下可 mock 或二次确认 | `PointsCenter.tsx`、支付相关 lib、env 判断 | P2 |
| F38 | 依赖审计 | 定期 `npm audit`；对 high/critical 制定升级或替换计划并记录 | 根与 client-web package.json、文档或 CI | P1 |

---

## 六、前端 — 技术栈升级

### 6.1 依赖版本

| 序号 | 任务 | 说明 | 涉及文件 | 优先级 |
|------|------|------|----------|--------|
| F39 | React Query v3 → v5 | 升级到 @tanstack/react-query v5；替换 `useQuery`/`useMutation` 的废弃选项；QueryClient 与 Provider 按新 API 调整 | `client-web/package.json`、`main.tsx`、所有使用 react-query 的文件 | P1 |
| F40 | React 18 → 19 | 评估 react-router-dom、react-query、framer-motion、@livekit 等兼容性后升级；关注 useActionState、use 等新 API 是否可简化代码 | `client-web/package.json`、全站 | P2 |
| F41 | Vite 5 小版本 | 保持 5.x 最新小版本，修复安全与 bug | `client-web/package.json` | P2 |
| F42 | 其他依赖小版本 | Tailwind、TypeScript、Vitest、Playwright 等按兼容性升级小版本；锁定 major 避免静默大版本升级 | 各 package.json | P2 |

### 6.2 状态与架构

| 序号 | 任务 | 说明 | 涉及文件 | 优先级 |
|------|------|------|----------|--------|
| F43 | 用户/会话状态集中 | 用 Zustand 或 Context 存当前用户、ckbAddress、积分余额等，各页从 store 读，减少 sessionStorage 分散读取 | 新建 store 或扩展现有 `stores/index.ts`、各页面 | P1 |
| F44 | 未读通知数 | TopNav 红点与未读数量从接口或 store 统一获取，避免多源 | `TopNav.tsx`、messaging/notifications API、store | P2 |

---

## 七、后端与网关

### 7.1 API 与契约

| 序号 | 任务 | 说明 | 涉及文件 | 优先级 |
|------|------|------|----------|--------|
| B1 | 各服务 OpenAPI/Swagger | identity、payment、content、metadata、live 等暴露 OpenAPI 3.0 描述（可手写或从路由生成），便于前端生成类型与 Mock | 各 `services/*/src/`、可选 openapi-generator | P1 |
| B2 | 网关统一请求 ID | 请求进入网关时生成并透传 X-Request-Id，下游日志与 tracing 使用同一 ID | `services/identity/src/server.ts`（代理前注入 header） | P1 |
| B3 | 网关限流与熔断 | 对下游超时或 5xx 做熔断或降级，避免雪崩；限流策略与现有 rate-limit 对齐 | identity 网关、可选 resilience 中间件 | P2 |

### 7.2 可观测与运维

| 序号 | 任务 | 说明 | 涉及文件 | 优先级 |
|------|------|------|----------|--------|
| B4 | 未暴露 /metrics 的服务 | royalty、nft、live、achievement、governance、bridge、engagement 等补充 `/metrics`（prom-client 或 shared monitoring） | 各 `services/*/src/server.ts` | P1 |
| B5 | Grafana 大盘 | 基于现有 Prometheus scrape 配置，制作请求量、延迟、错误率、业务指标（登录、支付、播放）大盘 | `deploy/` 或文档中 Grafana json | P2 |
| B6 | 前端打点 | 关键操作（播放开始、支付完成、登录成功）上报到自定义 analytics 或 Prometheus pushgateway，便于转化分析 | 前端埋点层、后端接收端点（可选） | P2 |

### 7.3 业务接口对齐

| 序号 | 任务 | 说明 | 涉及文件 | 优先级 |
|------|------|------|----------|--------|
| B7 | 推荐/任务/成就 API | 确保 engagement、achievement 与前端 useApi 使用的路径、参数、响应格式一致；文档或 shared 类型对齐 | 各 service、shared/types、前端 useApi | P1 |
| B8 | 搜索与建议词 | 搜索接口与 Meilisearch/search 服务对接；支持建议词、历史记录（若产品需要） | `services/search`、TopNav 或搜索页 | P2 |
| B9 | 审核状态与 moderation | 上传/发布后展示「审核中/未通过」及原因（若策略允许），与 moderation 服务打通 | metadata、moderation、前端 CreatorUpload/VideoList | P2 |

---

## 八、DevOps 与质量保障

| 序号 | 任务 | 说明 | 涉及文件 | 优先级 |
|------|------|------|----------|--------|
| D1 | CI 流水线 | 每次 PR 或 push 运行：lint、typecheck、client-web 单测、可选 E2E smoke；通过后再合并 | `.github/workflows/` 或 CI 配置 | P1 |
| D2 | 构建与镜像 | 前端 build 产出与后端服务分别构建 Docker 镜像；镜像内不包含 .env.local | `deploy/`、Dockerfile | P2 |
| D3 | 环境与密钥 | 生产环境变量与密钥通过 CI/平台注入，文档中说明必填项与可选项 | `docs/`、`.env.example` | P1 |

---

## 九、产品与内容

### 9.1 多语言

| 序号 | 任务 | 说明 | 涉及文件 | 优先级 |
|------|------|------|----------|--------|
| P1 | i18n 键全覆盖 | 所有用户可见文案使用 `t(key)`，无硬编码中文/英文；错误信息、空状态、按钮、标题等统一走 i18n | `client-web/src/i18n/zh.json`、`en.json`、各组件 | P1 |
| P2 | 缺失 key 的补充 | 扫描代码中 `t('xxx')` 与 json 中 key，补全缺失项并统一命名空间 | i18n 文件、各页面 | P2 |

### 9.2 功能闭环（与后端对齐）

| 序号 | 任务 | 说明 | 涉及文件 | 优先级 |
|------|------|------|----------|--------|
| P3 | 继续观看进度 | 播放进度上报与拉取与 content 服务一致；Home「继续观看」展示进度条与续播跳转 | Home、VideoPlayer、content API | P1 |
| P4 | 收藏/稍后观看 | 收藏、稍后观看与 content/watchlist 或 metadata 接口打通，列表与播放页展示一致 | VideoPlayer、VideoList、Home、content/metadata | P2 |
| P5 | 倍速/画质持久化 | 用户选择的倍速、画质写入 localStorage 或账号偏好，下次进入播放器默认应用 | VideoPlayer、可选 user prefs API | P2 |
| P6 | 直播筛选与礼物 | 探索页按分类/人气/时间筛选；直播间礼物与打赏与 payment 打通，排行榜与动效 | Explore、Live、payment/live 服务 | P2 |
| P7 | 积分流水与导出 | 积分中心支持按时间/类型筛选流水；可选导出 CSV（后端支持时） | PointsCenter、payment API | P2 |
| P8 | 上传拖拽与重试 | 创作者上传支持拖拽、多文件、失败重试与断点续传（TUS 已有时完善 UI） | CreatorUpload | P2 |

---

## 十、分阶段建议与优先级汇总

### 阶段一（1–2 周）：体验与稳定性

- **P0/P1 前端**：F15、F16、F18、F20、F21、F24（骨架屏、表单态、Tab 高亮、a11y、键盘、触摸）。
- **P1 前端**：F1（Feed 虚拟化）、F5（LazyImage 推广）、F8/F9（bundle 分析、video 按路由拆）、F11/F12（Home/Player React Query）、F26（fun 变量收口）、F29/F30（shared DTO）、F35、F38（env、audit）。
- **P1 后端**：B1、B2、B4（OpenAPI、Request-ID、其余 /metrics）。
- **DevOps**：D1、D3（CI、环境文档）。

### 阶段二（2–4 周）：性能与数据层

- **P1 前端**：F2、F11–F14（分页、全面 React Query、重试策略）、F39（React Query v5）、F43（用户/会话 store）。
- **P1 后端**：B7（推荐/任务/成就对齐）。
- **产品**：P1、P3（i18n 覆盖、继续观看闭环）。

### 阶段三（1–2 月）：升级与长期

- **P2 前端**：F3、F4、F6、F7、F10、F17、F19、F22、F23、F25、F27、F28、F31、F33、F34、F36、F37、F40–F42、F44。
- **P2 后端**：B3、B5、B6、B8、B9。
- **P2 产品**：P2、P4–P8。
- **DevOps**：D2。

---

## 十一、优先级速查表

| 优先级 | 类别 | 任务编号示例 | 说明 |
|--------|------|--------------|------|
| P0 | 体验 | F15,F16,F18,F20,F21,F24 | 骨架屏、表单态、Tab、a11y、键盘、触摸 |
| P1 | 性能 | F1,F2,F5,F8,F9,F11,F12,F26,F29,F30 | 虚拟化、分页、LazyImage、bundle、RQ、样式与类型收口 |
| P1 | 安全/配置 | F35,F38,F39,F43 | env 文档、audit、React Query v5、用户 store |
| P1 | 后端 | B1,B2,B4,B7 | OpenAPI、Request-ID、/metrics、业务 API 对齐 |
| P1 | 产品 | P1,P3 | i18n 覆盖、继续观看 |
| P2 | 其余 | 上文未标 P1 的 F/B/P/D 项 | 按阶段三执行 |

---

## 十二、文档与约定（延续原计划）

- **路由**：新增页面在 `main.tsx` 的 `<Routes>` 注册，并在《界面板块梳理与优化/升级计划》中补充一行。
- **环境变量**：所有 `VITE_*` 在 `.env.example` 中列出并注释。
- **接口**：新接口在 shared 中补充类型或 DTO，并在本路线图或接口文档中注明服务与路径。
- **设计**：新组件优先使用 `index.css` 的 `:root` 与 Tailwind 工具类。

本路线图与《OPTIMIZATION_AND_UPGRADE_PLAN》及《BLOCKCHAIN_INTEGRATION》《METRICS_AND_GRAFANA》一起，构成接下来**细致、全面**的优化与升级计划，可按阶段与优先级逐项执行与验收。
