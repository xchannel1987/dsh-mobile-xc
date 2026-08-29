# dsh-mobile-xc

[![npm version](https://img.shields.io/npm/v/dsh-mobile-xc.svg)](https://www.npmjs.com/package/dsh-mobile-xc)
[![license](https://img.shields.io/npm/l/dsh-mobile-xc.svg)](https://github.com/xchannel1987/dsh-mobile-xc/blob/main/LICENSE)
[![downloads](https://img.shields.io/npm/dm/dsh-mobile-xc.svg)](https://www.npmjs.com/package/dsh-mobile-xc)
[![DSH](https://img.shields.io/badge/DeepSeek-Harness-blue)](https://github.com/deepseek-ai/DeepSeek-Harness)

[中文](README.md) | [English](README_EN.md)

**The ultimate mobile UI adaptation plugin for DeepSeek Harness** — integrating the best designs from multiple mobile plugins to deliver a native mobile experience.

## ✨ Core Features

### 📱 Mobile Drawer Navigation
- **Overlay Drawer**: Sidebar slides out as an overlay without affecting the main content area
- **Scrim Backdrop**: Tap the scrim to close the drawer, following mobile interaction patterns
- **Gesture Support**: Swipe to open/close drawer (configurable)
- **Escape Key Close**: Keyboard-friendly

### 🎨 Glass Card Design
- **Glassmorphism Style**: Modern frosted glass visual effect
- **Single-line Input**: Compact input area layout for mobile
- **FLIP Animations**: Smooth state transition animations
- **44px Touch Targets**: Meets mobile touch interaction standards

### 📐 Safe Area Coverage
- **Notch Adaptation**: Properly handles safe areas on iPhone X and similar devices
- **Home Indicator**: Prevents content from being obscured by gesture bar
- **Dynamic Viewport**: Supports `dvh` unit, auto-adjusts when keyboard appears

### 🔄 Smart Compatibility System
- **Version Mismatch Detection**: Automatically checks DSH version compatibility
- **Soft Warning**: Compatibility issues don't block usage, only notify
- **Fallback Degradation**: Auto-degrades in extreme cases to ensure usability
- **Third-party Plugin Compatibility**: Adapted for dshmarket, dsh-better-sidebar, etc.

### 📲 PWA Support
- **Official Whale Icon**: Uses DSH official favicon
- **Offline Ready**: Service Worker precaches critical resources
- **Installable**: Supports "Add to Home Screen"

## 🎯 Breakpoint Design

| Breakpoint | Behavior |
|------------|----------|
| ≤1023px | Mobile adaptation activated |
| ≥1024px | Desktop mode, zero impact |

Aligned with DSH built-in `SIDEBAR_AUTO_COLLAPSE=1024` for seamless switching.

## 📦 Installation

```bash
# Using DSH CLI
dsh plugin --profile web add dsh-mobile-xc

# Or using npm
npm install dsh-mobile-xc
```

Restart DSH after installation.

## ⚙️ Configuration

Configure via DSH Settings → "Mobile UI" section:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| enabled | boolean | true | Enable/disable mobile adaptation |
| gestureMode | 'swipe' | 'follow' | 'off' | 'swipe' | Drawer gesture mode |
| compatFixes | boolean | true | Third-party plugin compatibility fixes |

## 🔗 Compatibility Matrix

| Package | Verified Version | Status |
|---------|-----------------|--------|
| DSH (vendor) | 0.1.1-rc.2 | ✅ 18 selector mappings |
| dshmarket | 1.20.x | ✅ Nav dead-end fix |
| dsh-better-sidebar | 0.15.2 | ✅ Peaceful coexistence |
| dsh-token-usage | 0.2.16 | ✅ Compatibility registered |

## 🛠️ Development

```bash
pnpm install
pnpm verify        # Type check + lib drift check
pnpm test          # Unit tests
pnpm build         # Build artifacts
```

## 📄 License

[MIT](LICENSE)

## 🔗 Links

- [GitHub](https://github.com/xchannel1987/dsh-mobile-xc)
- [npm](https://www.npmjs.com/package/dsh-mobile-xc)
- [Issues](https://github.com/xchannel1987/dsh-mobile-xc/issues)
