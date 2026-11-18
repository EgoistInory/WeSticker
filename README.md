# WeSticker Studio 2.0 — 微信表情 AI 刀模精修与真机预检工坊

![Vue 3](https://img.shields.io/badge/Vue.js-3.5-07C160?style=flat-square&logo=vue.js)
![Vite](https://img.shields.io/badge/Vite-6.4-FF5A36?style=flat-square&logo=vite)
![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-v4-38B2AC?style=flat-square&logo=tailwind-css)
![Pure Frontend](https://img.shields.io/badge/Architecture-100%25_Client_Side_Vision-111827?style=flat-square)

**WeSticker Studio 2.0** 是一套面向 AI 创作者、独立插画师与 IP 运营团队的**全链路微信表情工程化工作台**。
我们从跨领域产品、视觉与图形学底层重新定义了表情制作流——不再只是一个简单的“改尺寸打包脚本”，而是打通 **「AI 九宫格母版切分 $\rightarrow$ 智能吸色去背 $\rightarrow$ 形态学刀模白边 $\rightarrow$ 撞色花字配文 $\rightarrow$ 真 GIF89a 动效合成 $\rightarrow$ 6 大运营图一键排版压制 $\rightarrow$ 微信深浅色真机沙盒预检 $\rightarrow$ 免检 ZIP 封装」** 的纯前端精密创作工坊。

---

## 🎯 核心架构升华 (Studio 2.0 四大破局点)

### 1. AI 多宫格母版激光切分舱 (AI Sprite Sheet Auto-Slicer)
* **痛点终结**：Midjourney / GPT-4o / Nano Banana 生成角色一致的表情包时，通常产出一张 `3×3` 或 `4×4` 的纯色背景九宫格大图。
* **引擎能力**：支持 `2×2`、`3×3`、`4×4`、`4×6` 网格实时激光对齐、单格边缘内缩去杂边（Trim Margin），并在切分瞬间自动执行**四角背景吸色抠图（Smart Chroma-Key）**，一键将 1 张大图切分为 9~24 张独立居中的透明贴纸导入矩阵。

### 2. 刀模级贴纸精修实验室 (Morphological Die-Cut & Caption Lab)
* **圆润刀模白边 (`Stroke 0~10px`)**：采用 24 向径向形态学膨胀合成算法，为不规则透明角色生成均匀平滑的贴纸白边与柔和微投影，彻底解决深色角色在微信深色模式（`#111111`）下“隐身”或被审核驳回的问题。
* **智能色度去背 (`Chroma-Key`)**：支持四角自动采样、纯白底、绿幕抠图与边缘羽化容差调节。
* **防越界撞色花字 (`Meme Typography`)**：内置「经典白字、波普撞色、赛博翠绿、暴躁火焰」4 套双层描边花字引擎，每张贴纸可独立行内改字、实时重绘，并严格避让外围 `2px` 强制透明留白红线。

### 3. 真 `GIF89a` 二进制编码器与微动效合成 (`src/utils/gifEncoder.ts`)
* **告别“假 GIF”隐患**：改变旧版仅将 `.png` 改后缀为 `.gif` 的做法，纯前端手写标准 **GIF89a 二进制编码器**（含 256 色自适应量化、透明通道索引 `0xF9`、Netscape 2.0 循环扩展与 LZW 压缩）。
* **一键注入动效**：支持将单张静态原图一键合成为 **「Q弹果冻 (Bounce)」、「魔性摇摆 (Wiggle)」、「心跳呼吸 (Pulse)」** 多帧动态 GIF89a 表情，且每一帧均强制执行外围 `2px` 透明安全边界裁切。

### 4. 运营物料一键合成器 & 微信真机双模沙盒
* **零 PS 合成全套 6 张运营图**：内置 4 套视觉艺术风格（瑞士暖白工坊、微信原生翡翠、新野兽派波普、黑曜石极客网格），自动提取当前表情矩阵与标题排版生成 `详情页封面 (240×240)`、`聊天图标 (50×50)`、`详情页横幅 (750×400 ≤80KB)`、`艺术家主页 (750×400 ≤80KB)`、`赞赏引导 (750×560 ≤90KB)`、`赞赏致谢 (750×750 ≤200KB)`，同时保留 `vue-cropper` 定比手动精裁。
* **微信真机双模实时模拟器**：右侧常驻 iPhone 模拟器，支持 **「群聊实测（一键切换微信浅色 `#EDEDED` / 深色 `#111111` 模式，点击左侧贴纸即可实时发入群聊看效果）」** 与 **「表情商店详情页 1:1 预览」**，底部配备**提审合规预检雷达**。

---

## 📦 导出 ZIP 标准结构

点击右上角 **「导出免检 ZIP」** 后，浏览器内存将直接生成符合微信表情开放平台规范的压缩包：

```text
/{专辑名称}_WeChat.zip
  └── /{专辑名称}_WeChat/
        ├── /表情主体/ (01.gif, 02.gif ... 真 GIF89a 或透明 PNG，严格 240×240 含 2px 透明留白)
        ├── /表情缩略图/ (01.png, 02.png ... 严格 120×120 PNG)
        ├── 封面图_cover.png       (240×240 PNG, ≤80KB)
        ├── 聊天图标_icon.png      (50×50 PNG, ≤30KB)
        ├── 横幅图_banner.jpg      (750×400 JPEG, 动态压制 ≤80KB)
        ├── 艺术家主页_artist.jpg   (750×400 JPEG, 动态压制 ≤80KB)
        ├── 赞赏引导_reward_guide.jpg (750×560 JPEG, 动态压制 ≤90KB)
        ├── 赞赏致谢_reward_thanks.jpg (750×750 JPEG, 动态压制 ≤200KB)
        └── 提审自检报告_manifest.txt (每张物料精确尺寸与 KB 体积审计清单)
```

---

## 💻 本地开发与构建

```bash
# 1. 安装依赖
npm install

# 2. 启动本地热更新工作台
npm run dev

# 3. 类型检查与生产环境静态构建
npm run build
```
