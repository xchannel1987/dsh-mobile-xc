# dsh-mobile-xc

[![npm version](https://img.shields.io/npm/v/dsh-mobile-xc.svg)](https://www.npmjs.com/package/dsh-mobile-xc)
[![license](https://img.shields.io/npm/l/dsh-mobile-xc.svg)](https://github.com/xchannel1987/dsh-mobile-xc/blob/main/LICENSE)
[![downloads](https://img.shields.io/npm/dm/dsh-mobile-xc.svg)](https://www.npmjs.com/package/dsh-mobile-xc)
[![DSH](https://img.shields.io/badge/DeepSeek-Harness-blue)](https://github.com/deepseek-ai/DeepSeek-Harness)

[中文](README.md) | [English](README_EN.md)

**DSH Web 移动端 UI 完美适配插件** —— 整合多个移动端插件的最优设计，为 DeepSeek Harness 提供原生的移动端体验。

## ✨ 核心特性

### 📱 移动端抽屉导航
- **Overlay 抽屉**：侧边栏以覆盖层形式滑出，不影响主内容区
- **Scrim 遮罩**：点击遮罩关闭抽屉，符合移动端交互习惯
- **手势支持**：支持滑动打开/关闭抽屉（可配置）
- **Escape 键关闭**：键盘用户友好

### 🎨 玻璃卡片设计
- **Glassmorphism 风格**：现代毛玻璃视觉效果
- **一行输入框**：移动端输入区紧凑布局
- **FLIP 动画**：流畅的状态切换动画
- **44px 触控热区**：符合移动端交互标准

### 📐 Safe Area 全覆盖
- **刘海屏适配**：正确处理 iPhone X 等机型的安全区域
- **底部手势条**：避免内容被手势条遮挡
- **动态视口**：支持 `dvh` 单位，键盘弹出时自动调整

### 🔄 智能兼容系统
- **版本失配检测**：自动检测 DSH 版本兼容性
- **软告警机制**：兼容问题不阻塞使用，仅提示
- **兜底降级**：极端情况下自动降级，保证可用
- **第三方插件兼容**：已适配 dshmarket、dsh-better-sidebar 等

### 📲 PWA 支持
- **官方黑鲸鱼图标**：使用 DSH 官方 favicon
- **离线可用**：Service Worker 预缓存关键资源
- **可安装**：支持添加到主屏幕

## 🎯 断点设计

| 断点 | 行为 |
|------|------|
| ≤1023px | 移动端适配激活 |
| ≥1024px | 桌面模式，零影响 |

与 DSH 内置 `SIDEBAR_AUTO_COLLAPSE=1024` 对齐，无缝切换。

## 📦 安装

```bash
# 使用 DSH CLI
dsh plugin --profile web add dsh-mobile-xc

# 或使用 npm
npm install dsh-mobile-xc
```

安装后重启 DSH 即可生效。

## ⚙️ 配置

插件可通过 DSH 设置 → 「移动端 UI」分区进行配置：

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| enabled | boolean | true | 启用/禁用移动端适配 |
| gestureMode | 'swipe' | 'follow' | 'off' | 'swipe' | 抽屉手势模式 |
| compatFixes | boolean | true | 第三方插件兼容修复 |

## 🔗 兼容性矩阵

| 包 | 验证版本 | 状态 |
|---|---|---|
| DSH (vendor) | 0.1.1-rc.2 | ✅ 18 条 selector 映射 |
| dshmarket | 1.20.x | ✅ 导航死路修复 |
| dsh-better-sidebar | 0.15.2 | ✅ 和平共存 |
| dsh-token-usage | 0.2.16 | ✅ 已注册兼容 |

## 🛠️ 开发

```bash
pnpm install
pnpm verify        # 类型检查 + lib 漂移检查
pnpm test          # 单元测试
pnpm build         # 构建产物
```

## 📄 许可证

[MIT](LICENSE)

## 🔗 链接

- [GitHub](https://github.com/xchannel1987/dsh-mobile-xc)
- [npm](https://www.npmjs.com/package/dsh-mobile-xc)
- [问题反馈](https://github.com/xchannel1987/dsh-mobile-xc/issues)
