# Gemini 3 UI 生成执行计划

> **使用方式**：切换到 Gemini 3 → 复制下面的 Prompt → 生成 UI → 保存图片 → 切回 Antigravity 实现代码

---

## 🎨 设计系统上下文（每次都先发这段）

```
你是 Nexus Video Platform 的 UI 设计师。请为我生成高质量的 UI 界面设计图。

# Nexus 设计系统

## 品牌
- 名称：Nexus — Web3 去中心化娱乐平台
- 功能：视频、音乐、文章、直播 + AI 创作 + 区块链版权

## 颜色
- 背景：#0a0a12 (深空黑)
- 表面：rgba(255,255,255,0.05) (玻璃态卡片)
- 边框：rgba(255,255,255,0.1)
- 主色 Purple：#a855f7
- 副色 Cyan：#22d3ee
- 强调 Pink：#ec4899
- 成功 Green：#10b981
- 警告 Gold：#f59e0b
- 文字主：#e5e5e5
- 文字次：#9ca3af

## 风格
- 暗色赛博朋克 / 未来科技感
- 玻璃态 (glassmorphism) 卡片
- 紫色/青色霓虹发光效果
- 微妙渐变边框
- Inter 字体 (UI), monospace (数据)

## 导航栏布局 (⚠️非常重要⚠️)
- **左侧全局边栏 (Sidebar)**：固定在极左侧，深色底。包含顶部 NEXUS Logo, 中央导航项 (Home, Explore, Live, Audio, 创作者中心图标等), 下方是用户功能按钮。
- **不可有双边栏**：任何界面都不要画两个左侧边栏。只有一个最外层的黑/紫色半透明菜单。
- **页面顶栏 (TopBar)**：位于主内容区上方。例如 Studio 页面会显示 "⚡ STUDIO Dashboard Content Analytics Contracts & Splits"，右上角是积分余额 (0.00 pts)、钱包余额、小铃铛通知、头像。

## 规格
- 分辨率：1920x1080
- 不要设备框架（手机/电脑壳）
- 只生成界面本身
```

---

## 📋 按阶段生成（每次只发一个页面的 Prompt）

### Phase 1-A: 音乐播放列表管理

把上面的设计系统上下文 + 下面的内容一起发给 Gemini 3：

```
请生成：音乐播放列表管理界面

布局说明：
- 页面标题："MY PLAYLISTS" 
- 左侧面板 (65%)：
  - 顶部：当前播放列表名称 "Synthwave Nights" + 编辑按钮
  - 曲目列表：序号、缩略图(40x40圆角)、曲名、歌手、时长、♥按钮
  - 可拖拽排序（显示拖拽手柄图标）
  - 正在播放的曲目用紫色高亮条标记
  - 列表底部："Add Track" 按钮

- 右侧面板 (35%)：
  - "Daily Mix" 推荐卡片（3张竖向排列）
  - 每张卡片：渐变背景 + 专辑封面 + 曲目数量 + "Play" 按钮
  - 卡片有玻璃态效果和紫色发光边框

- 底部固定：全局迷你播放器条 (64px高)
  - 左：缩略图 + 曲名/歌手
  - 中：进度条（紫→粉渐变）
  - 右：上一曲/播放暂停/下一曲/音量

请生成这个界面的高保真设计图，保存为图片。
```

**保存路径**：`d:\111new_sp\new_sp\video-platform\design\playlist-management.png`

---

### Phase 1-B: 文章阅读器增强

```
请生成：沉浸式文章阅读界面

布局说明：
- 顶部：极细阅读进度条（通栏，紫→粉渐变，2px高）
- 左侧浮动侧栏 (200px)：
  - 目录导航（Table of Contents）
  - 当前章节用紫色高亮
  - 可收起/展开

- 中间主体 (680px 居中)：
  - 文章标题：大号衬线字体 "The Architecture of Tomorrow"
  - 作者信息：头像 + 名字 + 发布时间 + "12 min read"
  - 文章正文：衬线字体, 18px, 行高1.8
  - 文中有一段被用户高亮标注的文字（黄色半透明背景）
  - 有一个浮动工具栏在选中文字旁边（高亮、笔记、分享icon）
  - 文中有一张配图，带有图注

- 右下浮动：返回顶部按钮
- 底部：全局音乐迷你播放器（显示正在播放曲目）
- 文章末尾：相关文章推荐行（水平滚动卡片）

请生成这个界面的高保真设计图。
```

**保存路径**：`d:\111new_sp\new_sp\video-platform\design\article-reader.png`

---

### Phase 2-A: AI Music Lab

```
请生成：AI 音乐创作工作室界面

布局说明：
- 顶部面包屑：Creator Studio > AI Lab > 🎵 Music

- 左侧面板 (35%)："创作控制台"
  - 大文本区域："描述你想要的音乐..." (placeholder)
    示例已填入："A dreamy lo-fi hip hop beat with soft piano, 
    vinyl crackle, and a mellow female vocal humming the melody. 
    Rainy day mood."
  - 风格选择芯片：Pop, Rock, Lo-Fi ✓(选中), Jazz, Electronic, 
    Hip Hop, Classical, R&B, Ambient
  - BPM 滑块 (当前值: 85)
  - 时长选择：30s / 1min / 2min ✓ / 3min / 4min
  - 语言选择下拉：English ✓
  - "Include Vocals" 开关 (ON)
  - 大按钮："🎵 Generate Music" 紫→粉渐变

- 右侧面板 (65%)："Generated Tracks"
  - 3 个已生成的音轨卡片，竖向排列
  - 每个卡片：
    - 紫色渐变波形可视化（类似SoundCloud）
    - 播放/暂停按钮叠放在波形上
    - 曲名 "Rainy Lo-Fi Dreams #1" + 时长 "2:14"
    - 按钮行：⬇ Download, 🚀 Publish to Nexus, 🖼 Mint NFT
    - 玻璃态背景 + 微妙边框发光
  - 第一个卡片显示"正在播放"状态（波形有动画指示）
  - 底部有一个处于加载状态的卡片："✨ AI Composing..." 
    带脉动波形动画

- 底部：全局迷你播放器

请生成这个界面的高保真设计图。
```

**保存路径**：`d:\111new_sp\new_sp\video-platform\design\ai-music-lab.png`

---

### Phase 2-B: 平台绑定设置

```
请生成：第三方平台绑定设置界面

布局说明：
- 页面标题："🔗 Platform Connections"
- 副标题："绑定您的社交媒体账户，一键跨平台分发内容"

- 主体：2列卡片网格（6个平台）

卡片 1 - YouTube (已连接)：
  - 红色顶部边框
  - YouTube logo + "YouTube"
  - 绿色圆点 "Connected"
  - 用户名 "@nexus_creator" + 头像
  - 粉丝数 "12.5K subscribers"
  - "Disconnect" 红色文字按钮

卡片 2 - TikTok (已连接)：
  - 黑/青顶部边框
  - TikTok logo + "TikTok"
  - 绿色圆点 "Connected"
  - "@nexus_official" + 粉丝数

卡片 3 - 抖音 (未连接)：
  - 灰色状态
  - "Connect" 按钮（紫色渐变）

卡片 4 - Instagram (未连接)：同上
卡片 5 - Bilibili (未连接)：同上
卡片 6 - Twitter/X (已连接)：同上

- 右侧栏 "Cross-Post Settings"：
  - 默认隐私：Public / Friends / Private 单选
  - "Auto-generate hashtags" 开关
  - "Add watermark" 开关
  - "Content compliance check" 开关 (ON)

请生成这个界面的高保真设计图。
```

**保存路径**：`d:\111new_sp\new_sp\video-platform\design\platform-bindings.png`

---

### Phase 3: AI Article Lab

```
请生成：AI 文章写作工作室界面（分屏编辑器）

布局说明：
- 顶部面包屑：Creator Studio > AI Lab > 📝 Article

- 左面板 (38%)："AI Writing Assistant"
  - 聊天式界面
  - 用户消息气泡："Write an introduction about the future of 
    decentralized music streaming"
  - AI 回复气泡（紫色边框）：显示一段生成的文字，
    底部有 "Insert to Editor" 按钮
  - 快捷操作按钮行：
    📋 Generate Outline / ✨ Expand Section / 
    🔄 Rewrite / 🌐 Translate / 🎨 Generate Cover
  - 底部输入框："Ask AI to write, edit, or translate..."

- 右面板 (62%)："Article Editor"
  - 格式工具栏：B I H1 H2 代码块 引用 图片 链接
  - 文章标题输入："The Future of Decentralized Music"
  - 正文内容：有几段文字
  - 其中一段左侧有紫色竖线标记 = "AI Generated"，
    旁边有 ✓ Accept / ✗ Reject 小按钮
  - 右上角：字数统计 "1,247 words · 6 min read"
  - 顶部右侧："Preview" 切换按钮

- 底部操作栏：
  - "💾 Save Draft" 按钮
  - "🚀 Publish" 紫色按钮
  - "📤 Cross-Post" 按钮
  - "🖼 Mint as NFT" 按钮

请生成这个界面的高保真设计图。
```

**保存路径**：`d:\111new_sp\new_sp\video-platform\design\ai-article-lab.png`

---

### Phase 4: AI Video Lab

```
请生成：AI 视频创作工作室界面

布局说明：
- 顶部面包屑：Creator Studio > AI Lab > 🎬 Video

- 上部区域："Prompt Zone"
  - 大文本区域："A neon-lit Tokyo street at night, rain reflecting 
    city lights, a lone figure walking with an umbrella, 
    cinematic camera follow shot"
  - 风格预设芯片：Cinematic ✓, Anime, Documentary, Music Video, 
    Product, Vlog, Abstract
  - 分辨率选择：720p / 1080p ✓ / 4K
  - 时长选择：5s / 10s / 15s ✓ / 30s
  - 比例：16:9 ✓ / 9:16 / 1:1
  - 参考图上传拖放区（虚线框 + 上传icon）
  - "🎬 Generate Video" 大按钮

- 中间主区域：视频预览播放器
  - 16:9 黑色播放器，显示一帧东京霓虹街景
  - 播放/暂停/全屏控制
  - 时间轴 "00:00 / 00:15"

- 下方时间线：
  - 水平时间轴，3个视频片段缩略图
  - 每个片段有时长标签
  - "+" 添加新片段按钮
  - 可拖拽排序

- 右侧面板 (25%)："Post-Production"
  - 🔤 Add Text Overlay
  - 🎵 Add Background Music（从Nexus音乐库选择）
  - 💬 Generate Subtitles (AI)
  - ⬇ Export (MP4 / WebM)
  - 🚀 Publish to Nexus
  - 📤 Cross-Post

请生成这个界面的高保真设计图。
```

**保存路径**：`d:\111new_sp\new_sp\video-platform\design\ai-video-lab.png`

---

### Phase 6-A: DAO 治理

```
请生成：DAO 社区治理仪表板界面

布局说明：
- 顶部统计条（4个大数字卡片横排）：
  - 👥 Total Members: 12,847
  - 💰 Treasury: 1.2M CKB
  - 📜 Active Proposals: 5
  - ⚡ Your Voting Power: 320 VP

- 主体：提案卡片网格（2列）
  提案卡片包含：
  - 标题："Increase creator revenue share to 92%"
  - 状态徽标：Active (绿) / Passed (蓝) / Rejected (红)
  - 投票进度条：For 67% (绿) vs Against 33% (红)
  - 剩余时间 "2 days remaining"
  - 提案者头像和名字
  - "Vote" 按钮

- 右侧面板："Your Governance"
  - 你的投票记录列表
  - NFT 持有量（影响投票权重）
  - "Create Proposal" 金色按钮

- 配色：使用金色 #f59e0b 作为治理主色调

请生成这个界面的高保真设计图。
```

**保存路径**：`d:\111new_sp\new_sp\video-platform\design\dao-governance.png`

---

### Phase 6-B: AI 创作版税仪表板

```
请生成：AI 创作版税追踪仪表板界面

布局说明：
- 页面标题："AI Royalty Dashboard"
- 副标题："Track earnings from your AI-generated content across all platforms"

- 顶部统计行：
  - 💰 Total Earnings: ¥ 12,580 (1,258 CKB)
  - 🎵 Music Royalties: ¥ 8,200
  - 📹 Video Royalties: ¥ 3,100
  - 📝 Article Royalties: ¥ 1,280
  - 📈 This Month: +23%

- 主图表区域：
  - 折线图：过去30天的每日收入趋势
  - 三条线分别代表音乐/视频/文章
  - 紫色/青色/粉色区分

- 下方：内容收入明细表格
  - 列：封面缩略图 | 标题 | 类型 | 平台 | 播放量 | 收入 | NFT状态
  - 行数据示例：
    - 🎵 "Rainy Lo-Fi Dreams" | Music | Nexus+Spotify | 12.3K | ¥420 | Minted ✓
    - 📹 "Tokyo Neon Walk" | Video | Nexus+YouTube | 5.1K | ¥180 | Pending

- 右侧：NFT 版税流水
  - 最近的链上交易记录
  - 每条：区块号 + 金额 + 时间

请生成这个界面的高保真设计图。
```

**保存路径**：`d:\111new_sp\new_sp\video-platform\design\ai-royalty-dashboard.png`

---

## ✅ 生成完成后

所有图片保存到 `d:\111new_sp\new_sp\video-platform\design\` 后，切回 Antigravity，说：

> "design 文件夹里的 UI 已经用 Gemini 3 生成好了，请按照设计图实现 Phase X 的页面"

Antigravity 会读取设计图并实现代码。
