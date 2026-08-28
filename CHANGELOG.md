# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
