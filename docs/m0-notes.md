# M0 里程碑记录（骨架）

日期：2026-08；分支：feat_mobileXc

## 交付内容

| 文件 | 职责 |
|---|---|
| package.json | dsh.client.platform:"web" + exports ./client；scripts：build / verify / test / prepack |
| src/index.ts | Host 半体占位（M5 落地 PWA 路由） |
| src/client/breakpoints.ts | MOBILE_QUERY '(max-width: 1023px)' 单一事实源（对齐 vendor SIDEBAR_AUTO_COLLAPSE=1024）；installMobileEffect 统一 matchMedia 重武装 |
| src/client/core/reconciler-core.ts | DOM-free 调度核：注册/脏键/rAF 合并/scope 过滤/错误隔离/幂等 dispose（零 import，node:test 可单测） |
| src/client/core/selector-map.ts | 哈希类登记制 + canary 校验（structural anchors + hashed selectors + 告警文案） |
| src/client/effects/debug.ts | ?mobile-nav-debug=1 徽标；不用 MutationObserver 自观（防自喂冻结） |
| src/client/styles/index.ts | base CSS 骨架：touch-action:manipulation + prefers-reduced-motion 正确语法 |
| src/client/index.ts | __ModuleLoader__ 包装入口：样式注入 → canary → reconciler 生命周期（窄屏激活）→ debug 徽标 |
| tests/reconciler-core.test.ts | 7 条单测（注册/激活/scope/合并/错误隔离/deactivate/unscoped） |
| scripts/verify-lib.mjs | esbuild JS API 内存构建 + sha1 与 lib/ 比对（--write 刷新） |
| .github/workflows/ci.yml | pnpm install → verify → test → build → lib 漂移 git diff |

## 关键决策落实

- DR5 效果调度：单全树 MutationObserver（attributeFilter 白名单）→ 脏键 → rAF 合并 → 按 scope 执行。
- DR3 选择器：M0 零哈希条目；canary 结构锚 = [data-shell-overlay] + [data-slot="conversation.composer.bar"]。
- 桌面零影响：全部 JS 效果经 installMobileEffect 只在窄屏激活；CSS 规则在媒体查询内。

## 待办（M1+）

- frame 标记 data-mobile-nav="frame"、overlay 抽屉 + scrim + details 浮层、safe-area 基线、
  Escape/aria-modal 让位/pointerup 平行路径、focus-guard、viewport/theme-color 基线、CDP 门禁。
- selector-map 开始登记 composer/header 哈希条目，并同步 docs/hash-audit.md。
