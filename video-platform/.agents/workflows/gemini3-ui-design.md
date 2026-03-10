---
description: Generate UI designs with Gemini 3 for Nexus platform pages, then hand off to code implementation
---

# Gemini 3 UI Design Workflow

## How to Use

1. Switch to **Gemini 3** model in the IDE
2. Paste the relevant prompt section below to Gemini 3
3. Gemini 3 generates the UI mockup image
4. Save the generated image to `d:\111new_sp\new_sp\video-platform\design\` folder
5. Switch back to **Antigravity (Claude)** for code implementation
6. Tell Antigravity: "根据 `design/xxx.png` 实现这个页面"

## Prompt Template

When talking to Gemini 3, start with this context block, then add the specific page prompt:

```
你是 Nexus Video Platform 的 UI 设计师。Nexus 是一个 Web3 去中心化娱乐平台，
融合视频、音乐、文章和直播功能，使用 CKB 区块链 + Fiber Network L2 微支付。

设计要求：
- 暗色主题：背景 #0a0a12，文字 #e5e5e5
- 主色：紫色 #a855f7 (nexusPurple)
- 副色：青色 #22d3ee (nexusCyan)
- 粉色强调：#ec4899 (nexusPink)
- 玻璃态效果 (glassmorphism)：rgba(255,255,255,0.05) 背景 + backdrop-blur
- 字体：Inter (UI), Playfair Display (标题), Monospace (数据/代码)
- 赛博朋克/未来感美学，参考 Spotify 暗色模式质感
- 分辨率：1920x1080，不需要设备边框
- 微动画提示：用虚线箭头或图标标注需要动画的元素

[具体页面 Prompt 粘贴在这里]
```
