# dsh-mobile-xc

[![npm version](https://img.shields.io/npm/v/dsh-mobile-xc.svg)](https://www.npmjs.com/package/dsh-mobile-xc)
[![license](https://img.shields.io/npm/l/dsh-mobile-xc.svg)](https://github.com/keyiadiannao/dsh-mobile-xc/blob/main/LICENSE)
[![downloads](https://img.shields.io/npm/dm/dsh-mobile-xc.svg)](https://www.npmjs.com/package/dsh-mobile-xc)

A comprehensive mobile UI adaptation plugin for DSH Web that integrates the best designs from dsh-mobile-glass, dsh-mobile-nav, dsh-mobile (TecFancy), dsh-mobile-webui, and dsh-web-mobile-fix.

## Features

- **Breakpoint**: Activates mobile adaptation at <=1023px (aligned with vendor SIDEBAR_AUTO_COLLAPSE=1024), zero impact on desktop >=1024px
- **Core Capabilities**:
  - Overlay drawer with scrim
  - Safe-area full coverage
  - Canary version mismatch detection (soft warning + fallback degradation)
  - Reconciler single-observer scheduling
  - PWA support (official DSH whale icon)

## Installation

```bash
# Using DSH CLI
dsh plugin --profile web add dsh-mobile-xc

# Or using npm
npm install dsh-mobile-xc
```

## Configuration

The plugin can be configured through DSH settings under the "Mobile UI" section.

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| enabled | boolean | true | Enable/disable mobile UI adaptation |
| gestureMode | 'swipe' | 'follow' | 'off' | 'swipe' | Gesture mode for drawer |
| compatFixes | boolean | true | Enable compatibility fixes for third-party plugins |

## Compatibility Matrix

| Package | Version | Status |
|---------|---------|--------|
| DSH (vendor hash) | 0.1.1-rc.2 | ✅ selector-map 18 entries + canary mismatch detection |
| dshmarket | 1.20.x | ✅ Nav dead-end countermeasure |
| dsh-better-sidebar | 0.15.2 | ✅ Peaceful coexistence |
| dsh-token-usage | 0.2.16 | ✅ COMPAT.tokenUsageGlue registered |

## PWA Support

- **Icon**: Official DSH black whale icon (rasterized to 192/512/180 + maskable)
- **Caching**: Service worker with minimal cache strategy
  - Pre-cache boot resources only
  - Other content-addressed resources: cache-first incremental healing
  - /api/* and /plugins/events: completely bypassed
  - Navigation: network-first with fallback to offline page

### Disable PWA

Set `localStorage['dsh-mobile-xc.pwa'] = 'off'` or unregister via DevTools → Application → Service Workers.

## Development

```bash
# Install dependencies
pnpm install

# Type checking
pnpm verify

# Run tests
pnpm test

# Build
pnpm build
```

## Requirements

- Node.js >= 18
- DSH >= 0.1.0-rc.2

## License

[MIT](LICENSE)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## Links

- [GitHub Repository](https://github.com/keyiadiannao/dsh-mobile-xc)
- [npm Package](https://www.npmjs.com/package/dsh-mobile-xc)
- [Report Issues](https://github.com/keyiadiannao/dsh-mobile-xc/issues)
