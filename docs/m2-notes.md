# M2 里程碑记录（composer 与键盘）

日期：2026-08；分支：feat_mobileXc

## 交付内容

| 文件 | 职责 |
|---|---|
| src/client/styles/compat.css.ts | 键盘 dvh 双声明、玻璃卡片（纯色 fallback + color-mix）、mirror 24/60 两态、一行契约（tools/modes/trailing）、add/primary 固定豁免、模型选择器收缩、底部 safe-area、汉堡避让标题、44px ::after 触控热区（pointer: coarse） |
| src/client/effects/composer.ts | createComposerHeightTask：RO 跟踪高度，focus/blur 置动画标记触发 FLIP，打字增长即时 |
| src/client/core/selector-map.ts | 登记 11 条 M2 哈希条目（dshVersion 0.1.1-rc.2，均含 reason/fallback） |
| src/client/effects/phone-chrome.ts | composeViewportContent 纯函数 + interactive-widget=resizes-content（Android 键盘重排；iOS 靠 dvh 链） |
| tests/phone-chrome.test.ts | composeViewportContent 3 用例 |

## 决策落实

- FR-3.1：CSS 只过渡 max-width；height 由 JS FLIP 仅在 focus/blur 时动画（打字即时，杜绝 glass 逐键动画开销）。
- FR-3.2：一行契约 + 固定控件豁免（add 28 / primary 34，mex 实测瓶颈）；send 由 trailing justify-end 钉右缘。
- FR-3.3：44px 热区用 ::after（pointer: coarse），不动布局（TecFancy D6）。
- FR-3.4：dvh 双声明 + viewport interactive-widget；composer 底部 env(safe-area-inset-bottom)。
- FR-3.5：focus-guard（M1 已交付）。
- FR-3.6：移动端保留 model label（ellipsis 截断），不隐藏——a11y 名称天然保留；状态行方案留作可选增强（非阻塞）。
- reduced-motion：base.css 全局 .01ms 关停（正确语法）。

## 验证方式

- pnpm verify + pnpm test（13 + 3 = 16）+ pnpm build。
- 真机键盘/旋转矩阵在 M4 统一执行；CDP plugin 模式含 composer 几何断言（add=28/send=34/无重叠）待装插件后跑（M5）。

## 待办（M3+）

- 设置面板全屏 + nav 修复 + dshmarket 死路反制；popover 重锚定；目录选择器底部固定；
  消息流/滚动条/溢出修补；第三方兼容开关（dshmarket/better-sidebar/token-usage）。
