# M3 里程碑记录（设置/弹层/内容 + 第三方兼容）

日期：2026-08；分支：feat_mobileXc

## 交付内容

| 文件 | 职责 |
|---|---|
| src/client/styles/misc.css.ts | 设置对话框全屏（抽屉含 aria-modal 时 :has 解除 transform 陷阱 + z50）、nav 横向滚动条（修 flex-basis 压零）、目录选择器底部固定行、popover 居中重锚定（composer 弹层打开临时移除卡片 backdrop-filter 防 fixed 被困）、agent-preset 底部弹层（拖拽手柄+细滚动条）、消息流滚动条/侧边距/字号/操作行溢出、dshmarket nav 死路反制（挂 html[data-xc-market-fix]）|
| src/client/config.ts | COMPAT 兼容开关（dshmarketNavFix / betterSidebarCoexist / tokenUsageGlue，默认全开） |
| src/client/effects/compat.ts | createMarketNavTask：检测 [data-dsh-market-root] -> 打 data-xc-market-fix（按开关） |
| src/client/core/selector-map.ts | 新增 7 条 M3 条目（VOzbGW_panel/nav、cubgiG_item、_scrollBody/_actions/_timeEnd 子串锚） |

## 决策落实

- FR-4.1/4.3：设置面板全屏纵向 min(100dvh)；nav 横滚按钮条 + safe-area 顶部。
- FR-4.2：dshmarket >=1.20 的 <=560px nav 隐藏死路，镜像反制由 compat 开关控制（默认开）。
- FR-7.1/7.2/7.3：composer/header 弹层居中定宽；agent-preset body portal 菜单改底部弹层；目录选择器底部固定行。
- FR-6.1/6.2/6.3：消息流滚动条隐藏、窄边距/字号 15px、操作行 timeEnd ellipsis。
- 决策 1（better-sidebar 和平共存）：本里程碑零冲突代码，COMPAT.betterSidebarCoexist=true 记录语义；
  决策 6（首版兼容范围 dshmarket/better-sidebar/token-usage）：market 已实现，其余对账登记。

## 验证方式

- pnpm verify + pnpm test（16）+ pnpm build 全绿。
- 弹层/设置/目录选择器真机矩阵在 M4 统一执行；CDP plugin 模式含对话框断言待装插件后跑（M5）。

## 待办（M4+）

- 手势：swipe 一次性触发（默认）+ 跟手拖拽（配置开，动态 touch-action:none）。
- 边缘让位 / 横滑豁免 / 拖拽 blur 降级 / 性能采样 / 真机清单（灵动岛/挖孔/键盘/旋转/深浅主题）。
