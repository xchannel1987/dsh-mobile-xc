# M1 里程碑记录（抽屉与布局）

日期：2026-08；分支：feat_mobileXc

## 交付内容

| 文件 | 职责 |
|---|---|
| src/client/styles/layout.css.ts | overlay 左抽屉 / 右 details / 遮罩 / 汉堡；safe-area 基线；桌面显式隐藏 |
| src/client/effects/phone-chrome.ts | viewport-fit=cover（保留 maximum-scale 锁）+ gesturestart 抑制 |
| src/client/effects/focus-guard.ts | 预交互 composer blur 防软键盘（首次 pointerdown 解除） |
| src/client/effects/drawer.ts | findFrame / makeSidebarToggle / frame-marker 任务（标记+角色标注+状态桥）/ drawer-chrome 任务（汉堡+遮罩）/ installOverlayInteractions（Escape 让位 aria-modal、点外关闭、treeitem 导航自动关、touch 走 pointerup 平行路径）|
| src/client/effects/tasks.ts | M1 任务注册器（同环境重载可重建） |
| src/client/core/selector-map.ts | StructuralAnchors 增 frameShape；checkStructuralAnchors 校验帧结构 |
| src/client/index.ts | M1 接线：注册任务 + 交互层 + phone-chrome + focus-guard |
| tests/selector-map.test.ts | formatCanaryReport 6 用例 |
| scripts/cdp-probe.mjs | CDP 门禁：移动/桌面两相断言 + baseline 冒烟模式 |

## 关键决策落实

- DR1 overlay：聊天列不位移（minmax(0,1fr) 0 0）；打开态 transform:none（保 portal 定位）。
- DR4 单状态源：开合状态= vendor data-sidebar-collapsed / data-details-collapsed；
  状态桥镜像到 data-xc-*（CSS/遮罩只认自有标记）。
- DR7 safe-area：帧 padding-top + 抽屉自身 padding-top（drawer 包含块是 frame padding box）+
  汉堡 top:calc(10px + env(safe-area-inset-top))。
- DR10 手势与语义解耦：汉堡点击只调 layout.toggleSidebar()（服务缺失降级告警）。
- 选择器：M1 零哈希类；frame/角色全部 data-mobile-nav 标注（saya 标注层思路的小型化）。

## 验证方式

- pnpm verify + pnpm test + pnpm build。
- node scripts/cdp-probe.mjs --expect=baseline：对当前未装插件的 dsh web 冒烟（验证 CDP 链路）。
- 完整 plugin 模式断言集（390x844 / 1440x900）需本机 profile 安装插件后执行（M5 发布前跑通）。

## 待办（M2+）

- composer 玻璃卡片 / 一行契约 / FLIP 状态切换 / 44px 热区 / 键盘 dvh / reduced-motion 对接。
- selector-map 登记 composer/header 哈希条目（uV2eYG_/wSkVaW_/VOzbGW_ 等）。
