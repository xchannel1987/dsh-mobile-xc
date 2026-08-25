# M4 里程碑记录（手势 + 真机打磨）

日期：2026-08；分支：feat_mobileXc

## 交付内容

| 文件 | 职责 |
|---|---|
| src/client/config.ts | 新增 GESTURE（dragEnabled=false 默认关；swipeThresholdPx=64） |
| src/client/effects/gesture.ts | installMobileGesture：touch/pen 限定、全 passive 永不 preventDefault、方向锁、跨表单控件/横滚区（pre/table）豁免、左边缘 16px 让位系统返回手势；swipe 一次性触发（开=右滑、关=左滑、同向不动作）；drag 模式（配置开）：激活瞬间 touch-action:none 夺回手势 + transition:none，位移/速度/百分比吸附，结束恢复（对治 glass 抖动根因），手势只改浮层 transform、状态仍走 layout.toggleSidebar()（DR10） |
| src/client/effects/drawer.ts | 交互层补点按判定（位移<10px 且 <500ms 才算 tap，与手势互斥，防 swipe/drag 的 pointerup 误触发点外关闭）；scrim 双触发修复（overlay 捕获层排除 scrim/ham，只留各自原生 click 单次开合） |
| src/client/index.ts | 接入 installMobileGesture |
| scripts/cdp-probe.mjs | plugin 模式新增 composer 几何断言（add=28 / send=34 / 无重叠） |

## 决策落实

- 决策 2（跟手默认关）：swipe 一次性触发为默认；GESTURE.dragEnabled 开关开启跟手。
- 边缘让位：clientX < 16px 不触发（Android 系统返回手势拥有边缘）。
- 横滑豁免：命中 overflow-x:auto/scroll 祖先（宽表格/代码块）时让位原生横滑。
- 拖拽 blur 降级：本设计抽屉背景无 backdrop-filter（bg-layer-1 纯色系），无模糊动画开销，无需降级——已在 m1 决策中规避玻璃的模糊成本。
- 性能：无 rAF 手势状态机（swipe 模式）、无 setPointerCapture、无 preventDefault——零抖动面；跟手模式为可选且默认关。

## 验证方式

- pnpm verify + pnpm test（16）+ pnpm build 全绿；probe node --check 通过。
- 真机清单见 docs/device-checklist.md（M4 末 + M5 安装后执行）。
- CDP plugin 模式（含 composer 几何断言）待 M5 装插件后跑。

## 待办（M5+）

- PWA：官方黑鲸鱼图标栅格化（scripts/rasterize-icons.mjs，sharp）、SW 收敛版（boot 预缓存 + cache-first 增量 + 自卸载）、动态 manifest（theme_color 跟随主题、去 orientation 硬锁）、设置项一键关闭。
- 本机 profile 安装实测：hash 验证 + CDP plugin 模式全断言 + README 兼容矩阵。
