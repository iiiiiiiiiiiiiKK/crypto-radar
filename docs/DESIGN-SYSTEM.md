# 设计系统

## 1. 定位

**Cyberpunk Trading Arena / Meme Terminal / Market Battlefield。**
不是券商终端，也不是 SaaS 后台：它应该看起来像一间正在运转的作战室——
编号模块、HUD 角标、实时播报流、行情跑马灯、像素吉祥物，全部服务于“真实数据”的可读性。

三条硬规则：

1. **数据优先**：价格、涨跌幅、成交额、K 线永远是视觉重心，装饰不得遮挡数据。
2. **Meme 是机制**：情绪判断、异动播报、分享卡片都由真实数据驱动，不是贴纸。
3. **克制**：发光、故障、扫描线只出现在少数强调位置，正文保持中性可读。

## 2. 颜色

| Token | 值 | 用途 |
| --- | --- | --- |
| `--bg` | `#06080b` | 全局底色 |
| `--panel` / `--panel-2` | `#0c1117` / `#101822` | 面板层次 |
| `--line` / `--line-2` | `#1a232d` / `#24313d` | 分隔线与控件描边 |
| `--ink` | `#edf3f9` | 主文字 |
| `--ink-2` / `--ink-3` | `#9daebd` / `#6a7a88` | 次级/三级文字 |
| `--up` | `#00f5a0` | 上涨 |
| `--down` | `#ff4d67` | 下跌 |
| `--blue` | `#55b8ff` | 交互/链接/科技蓝 |
| `--violet` | `#b18cff` | Meme 紫：资金费率、Studio |
| `--amber` | `#ffd166` | 警告、收藏、印章 |
| `--hot` | `#ff8a3d` | 成交额爆量 |

涨跌永远同时具备三种信号：颜色 + 正负号 + 方向箭头（`Delta` 组件），
不依赖颜色单独传达方向。

## 3. 字体

```css
--font-display: "Bahnschrift", "Segoe UI Variable Display", "PingFang SC", "Microsoft YaHei", …
--font-ui:      "Segoe UI", "PingFang SC", "Microsoft YaHei", system-ui, …
--font-mono:    "Cascadia Mono", "SF Mono", "JetBrains Mono", Consolas, …
```

* 数字一律等宽 + `font-variant-numeric: tabular-nums`，保证列对齐。
* 全部使用系统字体，不请求外部字体 CDN（离线/内网也能保持版式）。
* 中文走 PingFang SC / 微软雅黑回退，与等宽英文混排不跳行。

## 4. 栅格与模块

* 主内容 12 列（`--gap: 14px`），首页为 7/5 非对称分栏，避免“等宽卡片墙”。
* 每个模块是带编号的 console 面板：`panel__idx`（01…）+ 标题 + 提示 + 操作区。
* 面板默认直角、1px 描边、左上/右下 9px 角标（HUD 语言），只有首页 SITREP 使用斜切角 + 扫描线。
* 桌面 `--rail-w: 76px` 竖向导轨；≤900px 切换为底部 5 项导航，侧栏隐藏。

## 5. 组件清单

| 组件 | 说明 |
| --- | --- |
| `Panel` | 编号控制台面板（标题/提示/工具/页脚） |
| `PageHead` | 页面标题 + 英文 eyebrow + 描述 + 右侧操作 |
| `Delta` | 涨跌幅（颜色 + 符号 + 箭头），`arrow=false` 用于表格密度 |
| `Sparkline` | 无依赖 SVG 迷你走势（首页 BTC/ETH、Meme 卡片） |
| `Seg` / `Switch` / `Field` | 分段控件、开关、表单字段 |
| `StarButton` | 自选星标（即时反馈、`aria-pressed`） |
| `EmptyState` / `Notice` / `SkeletonRows` | 空、提示、加载 |
| `ConnectionPill` / `ConnectionBanner` | 连接状态与断线提示（含最后更新时间） |
| `EventRow` | 异动事件卡（规则图标 + 触发依据 + 指标 chip + 跳转/收藏） |
| `MarketGrid` | 虚拟化行情表（粘性表头、行级订阅、移动端紧凑列） |
| `CandleChart` | 蜡烛图 + 成交量 + 叠加指标 + RSI/MACD 副图（时间轴联动） |
| `RadarScanner`（页面内） | 规则编辑 + 实时命中表 |
| `MemeCardEditor` / `renderCard` | 5 个模板的 Canvas 渲染与 PNG 导出 |

## 6. 动效

可用：价格变化闪色（0.7s 一次性）、新事件滑入、雷达扫描（SITREP/扫描中）、
跑马灯（90s 线性、hover 暂停）、面板淡入。

禁止：无限闪烁、整页抖动、全站发光、阻断阅读的故障动画。

**两级降级**：`prefers-reduced-motion: reduce` 与设置页“减弱动效”
（`html[data-motion="calm"]`）都会把动画压到 0.001ms。

## 7. 响应式

| 断点 | 处理 |
| --- | --- |
| ≥1500 | 三栏图表工作区（226 / 1fr / 264） |
| 1280–1500 | 图表侧栏收窄；SITREP 变两段式 |
| ≤1100 | 栅格 12→6 列；Studio/Watchlist 单列 |
| ≤900 | 侧栏 → 底部导航；表格切紧凑列（价格 + 涨跌幅）；图表 460px；工具条收进筛选抽屉；跑马灯隐藏 |
| ≤560 | 字号下调、模板网格单列、弹窗高度收紧 |
| ≤430 | 事件卡改两行式（数值移到第二行） |
| ≤380 | 单列表单、工具条单列、移动标签字号降至 8px |
| 横屏 ≤480 高 | 隐藏跑马灯、底栏 48px、图表 70dvh |

实测视口：1440×900、1280×800、768×1024、430×932、390×844，全部 0 横向溢出。

### 移动端专用层（`src/styles/mobile.css`）

移动端不是把桌面缩小，而是单独一层覆盖，最后加载、优先级最高：

* **触控**：`(pointer: coarse)` 或 `≤900px` 时所有输入 ≥16px（iOS 聚焦不缩放页面），
  按钮/分段/筛选 chip ≥40px，`touch-action: manipulation` 去掉 300ms 双击延迟，
  `overscroll-behavior: contain` 防止滚动穿透到整页。
* **顶部**：手机上隐藏跑马灯与时钟；X 链接收成 44px 字形按钮；顶栏保持两行（品牌 + 搜索）。
* **首屏**：SITREP 两行结构（情绪整行 / 基准 + 覆盖并排），描述文字单行截断。
* **弹层**：Modal 走 `createPortal` 到 body，底部抽屉化（`align-items: end`，最大 86dvh）。
  `.page` 的入场动画用 `animation-fill-mode: backwards`——`both` 会让 transform 残留并成为
  `position: fixed` 的包含块，从而把抽屉顶出屏幕。
* **密度**：行情表 48px 行高，筛选移入抽屉，结果表在雷达页改卡片式两列。

## 8. 可访问性

* 所有可点击元素都是 `<button>`/`<a>`，带中文 `aria-label`。
* 星标、分段控件、指标开关使用 `aria-pressed` / `aria-selected` / `aria-sort`。
* 表格使用 `role="row"`，行可 `Tab` 聚焦、`Enter` 打开。
* 全局快捷键在输入框内不触发；`/` `?` `Esc` `R` `C` `W` `F` `1/2/3` 有说明弹窗。
* 正文对比度审计目标 ≥ 4.5:1（`npm run audit:layout` 会输出每页关键文本的对比度）。
* 颜色不是唯一信息通道（符号 + 箭头 + 文本状态）。
