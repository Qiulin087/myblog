# start2try 个人博客设计规范 (Design System & Specification)

本文档记录来自 Google Stitch 项目 **`start2try`**（Project ID: `18326797392758446254`）的个人博客设计系统规范。本规范为 `myblog` 个人博客首页及核心页面的重构与体验升级提供标准。

---

## 一、项目与页面概览 (Project & Screens)

- **项目名称**：`start2try`
- **项目 ID**：`18326797392758446254`
- **设计类型**：TEXT_TO_UI_PRO (Web 桌面端 & 响应式)
- **核心定位**：沉浸式暗黑极光美学（Cyber-Aurora Glassmorphism）个人博客导航中心

### 1.1 项目中的主要设计页面列表

| 页面标识 / Screen ID | 页面标题 / 版本名称 | 尺寸 | 状态 / 备注 |
| :--- | :--- | :--- | :--- |
| `a82acd50010743a493dfeff80adf3f34` | **秋林个人博客导航页 (Web 桌面端 - 沉浸动效交互版)** | 2560 × 2048 | ⭐ **精选标星版本 (isFavourite: true)**，具备完整粒子星空连线、点击波纹、极光背景及 3D 磁贴卡片 |
| `146b5b9728fc4c8281b5ae6ffb4e2044` | **秋林个人博客导航页 (Web 桌面端 - 艺术级重构版)** | 2560 × 2184 | 最新艺术级迭代，强化了卡片圆角（`rounded-3xl`）、悬浮微旋转（`group-hover:rotate-6`）与弥散光影 |
| `6907e146745f4476b09c005d945ca7dc` | **极简博客导航页 (Web 桌面端 - 优雅动态背景版)** | 2560 × 2246 | 极简动态背景版探索 |

> 注：画布中另包含早期与移动端历史原型版本（如移动端首页 `c2cb00d9`、紧凑动效版 `c1d5b428` 等），核心落地以 `a82acd50` 及 `146b5b97` 为统一基准。

---

## 二、设计语言与视觉风格 (Visual Philosophy)

- **设计美学**：**深邃暗夜黑曜石（Obsidian Deep） + 极光弥散雾光（Aurora Mesh） + 玻璃拟态（Glassmorphism）**。
- **情感氛围**：兼具极客探索感与人文沉浸感。利用深黑夜空衬托柔和的高饱和霓虹色彩（薰衣草蓝、电光紫、柔粉、翠绿），营造未来感与静谧阅读空间。
- **空间层次（Elevation & Depth）**：
  - **背景层**：全屏动态 Canvas 互动粒子网格（鼠标引力、点击涟漪波纹） + 3 个超大模糊（`blur-[160px]`）极光渐变光斑慢速漫游。
  - **容器层**：深色半透明毛玻璃（`backdrop-blur-xl` / `backdrop-blur-2xl`，背景色透明度 75%~90%），搭配极细微光边框（`1px border-white/10` 或 `outline-variant`）。
  - **交互层**：元素在悬浮时触发柔和的多色漫射外发光（Glow Shadows）及 3D 磁性透视倾斜。

---

## 三、色彩系统 (Color Tokens)

设计系统基于 Material Theme / Tailwind 扩展色彩体系，提供高反差且护眼的暗色调体系：

### 3.1 核心色彩盘 (Core Palette)

| 语义 Token | Hex 值 | 作用说明 |
| :--- | :--- | :--- |
| **`background` / `surface`** | `#0c072f` / `#0f172a` | 主页面画布底色（深邃黑曜夜空蓝） |
| **`surface-container`** | `#171241` | 标准卡片/面板毛玻璃底色（配合 85%~90% 不透明度） |
| **`surface-container-high`**| `#1d184b` | 悬浮态卡片、高亮微容器底色 |
| **`surface-container-highest`**| `#231d55` | 分割线与最高对比度容器边缘 |
| **`surface-bright`** | `#29235f` | 提亮层微光底色 |
| **`primary`** | `#9aa8ff` | 主交互色、高亮强调色（薰衣草电光蓝） |
| **`primary-container`** | `#8999ff` | 主行动按钮（CTA）、主要图标背景 |
| **`on-primary`** | `#001c8d` | 主按钮及主图标内的文字/图标反差色 |
| **`secondary`** | `#9891ff` | 次级焦点色、生活记录卡片主题色（紫罗兰） |
| **`secondary-container`** | `#4036a0` | 生活记录图标容器背景 |
| **`tertiary`** | `#ffade6` | 第三焦点色、学习理解卡片主题色（霓虹粉） |
| **`tertiary-container`** | `#ff95e3` | 学习理解图标容器背景 |
| **`on-surface`** | `#e7e2ff` | 主标题与重点文字正文色（清透亮白微带浅紫） |
| **`on-surface-variant`** | `#aba6d5` | 副标题、描述性辅助说明文字（柔和低饱和淡紫灰） |
| **`accent-emerald` (Status)** | `#10b981` / `#4ade80` | 状态指示呼吸灯、微状态绿色高光 |
| **`outline-variant`** | `#47436c` | 玻璃拟态默认边框色（通常配 30%~40% 透明度） |

---

## 四、字体排版系统 (Typography System)

### 4.1 推荐字体族 (Font Families)
- **展示级与大标题（Headlines/Display）**：`Space Grotesk`, `Merriweather`, sans-serif
- **阅读正文（Body Copy）**：`Inter`, `Archivo Narrow`, -apple-system, sans-serif
- **小型徽章与标签（Labels）**：`Inter`, `Anton`, monospace
- **图标系统**：`Google Material Symbols Outlined` (权重 400, FILL 0..1)

### 4.2 排版层级阶梯 (Scale)

| 级别 | 字号 / 行高 | 字重 | 字符间距 | 应用场景 |
| :--- | :--- | :--- | :--- | :--- |
| **`headline-xl`** | `48px` / `56px` | 700 (Bold) | `-0.02em` | 首页英雄区主问候（“你好，这里是秋林 👋”） |
| **`headline-lg`** | `36px` / `44px` | 600 (SemiBold) | `-0.01em` | 栏目页面大标题 |
| **`headline-md`** | `24px` / `32px` | 600 (SemiBold) | 标准 | 副标题、卡片分类主标题（随笔/学习/生活） |
| **`headline-sm`** | `18px` / `24px` | 500 (Medium) | 标准 | 主 CTA 按钮文字、品牌 Logo 文字 |
| **`body-lg`** | `18px` / `28px` | 400 (Regular) | 标准 | 正文大段导读 |
| **`body-md`** | `16px` / `24px` | 400 (Regular) | 标准 | 导航卡片描述文字 |
| **`body-sm`** | `14px` / `20px` | 400 (Regular) | 标准 | 辅助说明、页脚链接 |
| **`label-md`** | `12px` / `16px` | 600 (SemiBold) | `+0.05em` | 状态胶囊标签文字、卡片引导标签 |

---

## 五、圆角、间距与阴影 (Shapes, Spacing & Shadows)

### 5.1 圆角等级 (Border Radius)
- **小型控件/微卡片**：`0.5rem` (`rounded-lg`) ~ `0.75rem` (`rounded-xl`)
- **核心导航卡片**：`1rem` (`rounded-2xl`) 至 `1.5rem` (`rounded-3xl`)
- **胶囊标签 & CTA 按钮**：`9999px` (`rounded-full`)

### 5.2 间距网格 (Spacing)
- `space-xs`: `0.25rem` (4px)
- `space-sm`: `0.5rem` (8px)
- `space-md`: `1rem` (16px)
- `space-lg`: `1.5rem` (24px)
- `space-xl`: `2.5rem` (40px)
- `space-2xl`: `4rem` (64px)
- **页面边距 (Gutter)**: `1.5rem` (24px)
- **最大内容宽度**: 
  - 导航/页脚：`max-w-7xl` (1280px)
  - 卡片网格：`max-w-6xl` (1152px)
  - Hero 区域：`max-w-4xl` (896px) ~ `max-w-5xl` (1024px)

### 5.3 氛围光影 (Glow Shadows & Ambient Lighting)
- **主蓝光晕（Primary Glow）**：`shadow-[0_0_35px_rgba(137,153,255,0.35)]`
- **粉色光晕（Tertiary Glow）**：`shadow-[0_0_35px_rgba(255,149,227,0.35)]`
- **紫色光晕（Secondary Glow）**：`shadow-[0_0_35px_rgba(152,145,255,0.35)]`
- **CTA 悬浮辉光**：`shadow-[0_0_24px_rgba(137,153,255,0.5)]`

---

## 六、组件结构规范 (Component Blueprint)

### 6.1 顶部导航栏 (Glass Header)
- **布局**：固定顶部 `fixed top-0 w-full z-50 h-20`
- **材质**：`bg-surface/75 backdrop-blur-xl border-b border-white/5`
- **组成**：
  - **Brand**：左侧品牌标题 `Qiulin`（`font-headline-md hover:text-primary transition-colors`）
  - **Nav Items**：居中微光药丸导航链接（如“关于”），带有微透白底与悬浮外发光
  - **Actions**：右侧主题切换按钮（圆形磨砂卡片，36×36px，内嵌 Material 太阳/月亮图标）

### 6.2 英雄区 (Hero Section)
- **布局**：居中垂直流，带逐级延时的淡入向上动画（`animate-fade-in-up delay-100/200/300/500`）
- **元素**：
  1. **实时状态胶囊（Status Badge）**：
     - 外观：`rounded-full bg-surface-container-high/85 border border-primary/20 backdrop-blur-md`
     - 动效：内置绿色发光脉冲呼吸灯（`ping` + `dot` 动画）
     - 文案：“🟢 正在折腾：前端体验与博客打磨”
  2. **主标题（Title）**：
     - 样式：`text-headline-xl font-bold tracking-tight text-on-surface`
     - 文案：“你好，这里是秋林 👋”
  3. **副标题（Subtitle）**：
     - 样式：`text-headline-md text-on-surface-variant max-w-2xl`
     - 文案：“秋林的博客，记录生活与学习，慢慢理解世界”
  4. **主行动入口（CTA Button）**：
     - 样式：大圆角胶囊 `rounded-full bg-primary-container text-on-primary-container font-headline-sm shadow-[0_0_24px_rgba(137,153,255,0.4)]`
     - 动效：鼠标划入时，白色高光微波流光扫过（`animate-shimmer`），且整体微放大（`hover:scale-105 active:scale-95`）
     - 链接：“浏览我的记录 ↗” -> 指向 `/journal/`

### 6.3 3D 磁贴导航卡片组 (Tilt Feature Navigation Cards)
- **布局**：`grid grid-cols-1 md:grid-cols-3 gap-6`（桌面端 3 列平铺，移动端单列堆叠）
- **通用结构**：
  - 容器：`rounded-3xl bg-surface-container/90 backdrop-blur-2xl p-8 border border-outline-variant/40`
  - 磁性倾斜交互：监听鼠标在卡片上的相对位置，执行 `perspective(1000px) rotateX(...) rotateY(...) translateY(-6px)`
  - 内部右上角暗光球：`-top-24 -right-24 w-52 h-52 rounded-full blur-3xl pointer-events-none`，悬浮时亮度增强
  - 渐变底层：`from-theme-container/20 via-transparent to-transparent opacity-0 group-hover:opacity-100`
  - 悬浮展开指引：底部微边框与“查看随笔/笔记 ->”箭头悬浮浮现动画（`translate-y-2 -> translate-y-0, opacity 0 -> 100`）
- **3 张卡片主题差异**：
  1. **随笔 (Essays & Dispatches)**
     - 图标：`article`（主蓝色系 `bg-primary-container text-on-primary-container`）
     - 说明：记录日常思考、技术点滴与瞬息灵感。
     - 悬浮辉光：`hover:border-primary/80 hover:shadow-[0_0_45px_rgba(137,153,255,0.4)]`
     - 目标：`/archive/?category=随笔` 或 `/journal/`
  2. **学习理解 (Learning & Concepts)**
     - 图标：`school`（霓虹粉色系 `bg-tertiary-container text-on-tertiary-container`）
     - 说明：深入理解核心概念、框架原理与系统知识。
     - 悬浮辉光：`hover:border-tertiary/80 hover:shadow-[0_0_45px_rgba(255,149,227,0.4)]`
     - 目标：`/learning/`
  3. **生活记录 (Life & Moments)**
     - 图标：`favorite`（紫罗兰色系 `bg-secondary-container text-on-secondary-container`）
     - 说明：定格生活瞬间、影像、阅读与所见所闻。
     - 悬浮辉光：`hover:border-secondary/80 hover:shadow-[0_0_45px_rgba(152,145,255,0.4)]`
     - 目标：`/life/`

### 6.4 底部页脚 (Minimal Glass Footer)
- **布局**：`w-full bg-surface-container-low/90 backdrop-blur-xl py-space-2xl border-t border-surface-container-highest`
- **内容**：版权所有 `© 2026 Qiulin. All rights reserved.` 与极简行级链接（Privacy, Terms, RSS, Contact）

---

## 七、动效与交互技术规范 (Motion & Effects Engineering)

### 7.1 动画关键帧 (CSS Keyframes)
```css
/* 向上渐隐淡入 */
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-fade-in-up {
  animation: fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

/* 背景大极光慢速漫游流动 */
@keyframes gradientShift {
  0% { transform: translate(0px, 0px) scale(1); }
  50% { transform: translate(60px, 40px) scale(1.15); }
  100% { transform: translate(0px, 0px) scale(1); }
}
.animate-gradient-slow {
  animation: gradientShift 18s ease-in-out infinite;
}

/* 按钮微光闪烁流光 */
@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
.animate-shimmer {
  animation: shimmer 2.5s infinite;
}
```

### 7.2 HTML5 Canvas 交互背景逻辑
- **粒子星空网格（Constellation Network）**：
  - 160 个带呼吸动效（`size + sin(breath)`）的星光粒子。
  - 粒子之间距离小于 150px 时绘制半透明连线。
  - 粒子受鼠标位置引力与斥力排斥运算（`force` 反比距离）。
  - 鼠标移动带有光圈聚光灯（Radial Gradient Spotlight Follower）。
- **鼠标点击涟漪（Click Ripples）**：
  - 点击时在鼠标位置压入扩散圆环波纹，随半径扩大淡出，并为途径的粒子赋予能量爆发加速度。
- **性能优化规范**：
  - 仅在桌面大屏或开启 GPU 加速时渲染；
  - 监听 `prefers-reduced-motion`，当用户开启减弱动效时自动暂停 `requestAnimationFrame`。

### 7.3 3D 磁性卡片跟随计算
```javascript
const rect = card.getBoundingClientRect();
const x = e.clientX - rect.left;
const y = e.clientY - rect.top;
const xc = rect.width / 2;
const yc = rect.height / 2;
const dx = x - xc;
const dy = y - yc;
card.style.transform = `perspective(1000px) rotateX(${-dy / 10}deg) rotateY(${dx / 10}deg) translateY(-6px)`;
```

---

## 八、总结

该设计系统将原本偏向冷淡简约的博客首页，提升为充满数字艺术感、极高视觉张力与互动乐趣的沉浸式极光个人门户，同时完整保留了博客对随笔、学习、生活三个主干维度的清晰导航引导。
