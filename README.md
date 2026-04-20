# WeSticker Pro 微信表情极速打包工厂

![Vue 3](https://img.shields.io/badge/Vue.js-3.5-4FC08D?style=flat-square&logo=vue.js)
![Vite](https://img.shields.io/badge/Vite-8.0-646CFF?style=flat-square&logo=vite)
![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-v4-38B2AC?style=flat-square&logo=tailwind-css)
![Zero Backend](https://img.shields.io/badge/纯前端-0后端依赖-emerald?style=flat-square)

WeSticker 是一款为应对微信表情开放平台极其变态且人工易错的“反人类规范”而生的**全栈极致纯前端提效工具**。只需将您的 AI 绘画大图拽入系统，这台引擎将在浏览器本地内存里瞬间碾碎各种麻烦的人工步骤，压制出一份可毫无悬念 0 驳回的“绿色免检 ZIP”压缩包。

## 🚀 核心黑科技

- **极限压制算法 (Abyssal Compression)**：基于深层 `while` JPEG 图片渲染死循环，通过极小步长递归抹去多余画素，绝顶精确地将大横幅死锁在规定的 KB 之内（如详情页横幅 ≤80KB、致谢图 ≤200KB）。
- **完全原生的防黑边引擎**：智能探测并保护主图透明度，自动补充微信最苛求的 `2px` Alpha 隔离保护框。
- **全系六宫格补全机制**：一站式覆盖封面图 240²、图标 50²、详细页横幅 750x400、艺术家主页 750x400、赞赏引导 7560x560、赞赏致谢 750²。所有槽位集成可视化物理刚性裁剪。
- **伪装封装技术**：底层运用最高清无损的 PNG 生成主图，但在打包进 JSZip 时强行修改标识符生成极度清晰的 `.gif` 文件，以符合微信潜规则的宽容上限。

## 🛠️ 技术栈
- **框架构建**: Vue 3 (Composition API) + Vite
- **UI系统**: Tailwind CSS (呈现极客矩阵暗黑工业风)
- **底层图像处理**: HTML5 原生 `Canvas API` (`FileReader` / `Blob` / `toDataURL` 流水线)
- **重器组件**: `vue-draggable-plus` (拖放矩阵索引), `vue-cropper` (无损可视化刚性裁切), `jszip` + `file-saver` (云端虚拟建档)。

---

## 💻 快速安装与本地部署向导

此工程为纯静态 Web 应用。所有编解码器皆寄存在客户端，所以极度安全，无任何外部云端泄露忧患。

### 1. 环境准备
请确保您的操作系统具备 Node.js 环境（推荐 `v18.0.0` 或以上）：
```bash
node -v
npm -v
```

### 2. 克隆/打开目录与依赖下载
使用终端或 PowerShell 导航至本目录并重装依赖矩阵：
```bash
cd d:\YJ\StickerFlow
# 为防漏必须挂在本地锁
npm install
```

### 3. 开发环境拉起 (Hot-Reloading)
如果你要修改代码进行预览或直接日常使用本机环境进行生产：
```bash
npm run dev
```
之后打开您的浏览器：[http://localhost:5173/](http://localhost:5173/) 即可体验全套生态。

### 4. 生产级硬部署 (Build & Deploy)
当需要将这个小工具放在您的 GitHub Pages / Vercel 或公司内部静态云上给多名设计师协同使用时：
```bash
npm run build
```
这将在 `dist` 文件夹内部产出高浓度提取物。您只需将 `dist/` 里的所有静态网页部署至任何 Nginx / Apache / 云储存桶即可运行。无任何后端要求！

---

## 🎨 使用工作流参考

1. **拖拽主入**：在屏幕左侧的核心区，选中你所有生成好的 AI 图片一次性拉进方框。
2. **逻辑排序**：直接按住任意小框随意拖拽以整理顺位，系统直接识别顺位编排后续 ZIP 的序号规则 `01-nn`。
3. **设置封面**：默认使用 `#01` 首图补帧成为封面，你如果喜欢特殊的一张可以在其悬浮上方点击“★ 设为封面”。
4. **横幅压服**：如有赞赏或艺术家主页大图，扔进右边的空位（不用操心大尺寸，里面内嵌裁剪器并强制开启极限动态尺寸压制降频机制确保体积红线）。
5. **极速一指封包**：右上角填写专辑名称，点击 `打包免检 ZIP`。秒弹下载。把下载完的文件直接交予微信工作台即可。
