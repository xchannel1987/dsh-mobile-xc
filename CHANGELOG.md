# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.6.0] - 2026-09-11

### Added
- 会话页头标题簇横向滑动（`header-scroll` 状态层，默认开）：≤1023px 下页头第一行保持单行，
  「会话名 + PTC 模式 + 剩余用量 + token 用量徽标 + jobs」溢出时可左右滑动查看；右缘渐隐
  mask 提示仍有内容、滑到最右自动撤除（`data-xc-hscroll-more` 随溢出态可逆切换），滑到最右
  不留灰边。汉堡避让的 52px 留白在外层 `titleRow` 上，内容不会滑入汉堡底下。
- 设置卡新增「页头横向滑动」开关（配置项 `headerScroll`，默认开；关闭 = 字节级回到 0.5.8 表现）。
- 会话面包屑 `nav` 增加 96px 宽度地板（`min-width`）：标题短、徽标多时不再被 flex 压到 0 宽。
- selector-map 新增 3 条登记（0.1.5-rc.2）：`.wSkVaW_titleCluster`、`.wSkVaW_headerActions`、
  `.wSkVaW_crumbs`，失配时软告警并有各自安全兜底（最坏回 0.5.8 行为，不炸页头）。

### Fixed
- 反制 `dsh-token-usage-xc` 的 `@media (max-width:380px)` 页头换行：极窄屏（≤380px）徽标不再
  换行、页头不再长高一行；徽标 flex 收缩保护规则改为两臂并列（`.wSkVaW_headerActions > *` 槽锚臂 +
  `[data-slot="conversation.session.header.actions"] > *` 徽标根臂）。

### Changed
- Service Worker 缓存版本 bump 至 `202609-xc1`：activate 时删旧缓存并重收 boot 资源，真机 PWA
  不会继续拿旧 `client.js`。

## [0.5.4] - 2026-09-08

### Added
- Declare `engines.dsh` (`>=0.1.1-rc.2`) in package.json so dsh-market shows the
  host-version requirement and can filter by it. No functional change.

## [0.5.3] - 2026-09-03

### Fixed
- Prevent iOS Safari auto-zoom on input focus: mobile input/editable font-size is
  raised to 16px (the hard threshold below which Safari zooms the page on focus),
  covering inputs, textareas, selects and the composer contenteditable; pinch zoom
  is unaffected.

## [0.5.2] - 2025-01-20

### Added
- Gesture support: swipe to toggle drawer (replaced drag-to-follow)
- PWA support with official DSH whale icon
- Canary version mismatch detection with soft warnings
- Compatibility fixes for dshmarket, dsh-better-sidebar, dsh-token-usage

### Changed
- Improved reconciler single-observer scheduling
- Enhanced safe-area handling for mobile devices
- Better overlay drawer animations with FLIP technique

## [0.5.0] - 2025-01-15

### Added
- Overlay drawer with scrim
- Safe-area full coverage for notch/home indicator
- Focus guard and aria-modal support
- CDP gate for development

### Changed
- Refactored breakpoints to align with vendor SIDEBAR_AUTO_COLLAPSE=1024

## [0.4.0] - 2025-01-10

### Added
- Glass card composer
- 44px touch target compliance
- Keyboard dvh handling
- reduced-motion support

## [0.3.0] - 2025-01-05

### Added
- Settings panel mobile adaptation
- Third-party compatibility switches
- Plugin card styling fixes

## [0.2.0] - 2025-01-01

### Added
- Core reconciler implementation
- Selector-map for vendor DOM targeting
- Breakpoint detection system

## [0.1.0] - 2024-12-20

### Added
- Initial release
- Basic mobile UI detection
- CI/CD setup with GitHub Actions

---

For older versions, see git history.
