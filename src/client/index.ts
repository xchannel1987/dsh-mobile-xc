/**
 * dsh-mobile-xc — Client half 入口（M5：全功能整合）。
 *
 * 结构：PWA 关闭标记 -> 样式注入 -> canary 失配自检 -> reconciler 生命周期
 * （frame-marker / drawer-chrome / composer-height / market-nav-fix 任务）-> 交互层
 * （Escape/点外/导航自动关）-> 手势层（swipe 默认 + 跟手默认关）-> phone-chrome +
 * focus-guard -> 调试徽标。
 * exports.disablePwa：预留设置项一键关闭 PWA（localStorage 标记 + 卸载 SW）。
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { MOBILE_CSS } from './styles/index.ts'
import { getConfig, setConfig, onConfigChange, resolveSettingsValue } from './config.ts'
import type { XcConfig } from './config.ts'
import { installMobileEffect, MOBILE_QUERY } from './breakpoints.ts'
import { checkHashedSelectors, checkStructuralAnchors, formatCanaryReport } from './core/selector-map.ts'
import { createReconcilerCore } from './core/reconciler-core.ts'
import { installDebugBadge } from './effects/debug.ts'
import { installOverlayInteractions, makeSidebarToggle } from './effects/drawer.ts'
import { installMobileGesture } from './effects/gesture.ts'
import { registerDrawerTasks, registerComposerTasks, registerCompatTasks } from './effects/tasks.ts'
import { installFocusGuard } from './effects/focus-guard.ts'
import { installXcPluginCard } from './effects/plugin-card.ts'
import { installPhoneChrome } from './effects/phone-chrome.ts'
import { installComposerAutoCollapse } from './effects/composer.ts'

declare global {
  interface Window {
    __ModuleLoader__: {
      load(options: {
        id: string
        factory: (require: (spec: string) => unknown) => Record<string, unknown>
      }): void
    }
  }
}

window.__ModuleLoader__.load({
  id: 'dsh-mobile-xc',
  factory: (require: (spec: string) => unknown) => {
    const module: { exports: Record<string, unknown> } = { exports: {} }
    const exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
    // react 由 loader 提供（组件/插槽使用）；当前直接 DOM 注入，仅建立依赖关系。
    const react = require('react') as typeof import('react')

    /** 启用 PWA：清除关闭标记并重新注册 SW。 */
    const disablePwa = (): void => {
      if (typeof localStorage !== 'undefined') localStorage.setItem('dsh-mobile-xc.pwa', 'off')
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        void navigator.serviceWorker.getRegistrations().then((regs) => {
          for (const reg of regs) void reg.unregister()
        })
      }
    }
    const enablePwa = (): void => {
      if (typeof localStorage !== 'undefined') localStorage.removeItem('dsh-mobile-xc.pwa')
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        void navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => {})
      }
    }

    function apply(ctx: ClientContext): void {
      // 0) PWA 关闭标记：off 时卸载已注册 SW（host 注册脚本本身也会跳过）
      ctx.effect(() => {
        if (typeof localStorage !== 'undefined' && localStorage.getItem('dsh-mobile-xc.pwa') === 'off') {
          disablePwa()
        }
        return () => {}
      }, 'dsh-mobile-xc: pwa flag')

      // 0.1) 插件配置命名空间订阅（dshmarket 同款：设置 -> 插件 -> dsh-mobile-xc）。
      //      句柄形状：bind({namespace}) -> { getSnapshot(), set/unset, subscribe(listener) }；
      //      全程形状防御 + try/catch——任何异常都不允许阻断插件加载（早期版本曾因此白屏）。
      ctx.effect(() => {
        try {
          const anyCtx = ctx as unknown as { settingsScope?: unknown; get?(name: string): unknown }
        const face = (anyCtx.settingsScope ?? (typeof anyCtx.get === 'function' ? anyCtx.get('settingsScope') : undefined)) as
            | {
                bind(o: { namespace: string }): {
                  getSnapshot(): unknown
                  subscribe(listener: () => void): () => void
                }
              }
            | undefined
          if (face === undefined || typeof face.bind !== 'function') return () => {}
          const scope = face.bind({ namespace: 'dsh-mobile-xc' })
          if (scope === undefined || scope === null) return () => {}
          const readOnce = (): unknown => {
            try {
              return typeof scope.getSnapshot === 'function' ? resolveSettingsValue(scope.getSnapshot()) : undefined
            } catch {
              return undefined
            }
          }
          const seeded = readOnce()
          if (seeded !== undefined && seeded !== null) {
            try {
              setConfig(seeded as Partial<XcConfig>)
            } catch {
              /* 应用失败不阻断 */
            }
          }
          if (typeof scope.subscribe === 'function') {
            const off = scope.subscribe(() => {
              const next = readOnce()
              if (next !== undefined && next !== null) {
                try {
                  setConfig(next as Partial<XcConfig>)
                } catch {
                  /* 忽略 */
                }
              }
            })
            return () => {
              try {
                off()
              } catch {
                /* 忽略 */
              }
            }
          }
          return () => {}
        } catch {
          return () => {}
        }
      }, 'dsh-mobile-xc: settings namespace')

      // 0.2) 配置即时生效（当前项：PWA 开关）
      ctx.effect(() =>
        onConfigChange((cfg) => {
          try {
            if (cfg.pwaEnabled) enablePwa()
            else disablePwa()
          } catch {
            /* 忽略 */
          }
        }),
        'dsh-mobile-xc: pwa config reaction',
      )

      // 1) 样式注入（fiber 生命周期，卸载即移除）
      ctx.effect(() => {
        const tag = document.createElement('style')
        tag.dataset.plugin = 'dsh-mobile-xc'
        tag.textContent = MOBILE_CSS
        document.head.appendChild(tag)
        return () => {
          tag.remove()
        }
      }, 'dsh-mobile-xc: styles')

      // 2) canary 失配自检（软告警 + 兜底降级；strict 模式留待配置）
      ctx.effect(() => {
        const run = (): void => {
          const report = formatCanaryReport(checkStructuralAnchors(document), checkHashedSelectors(document))
          if (report !== null) console.warn('[dsh-mobile-xc] ' + report)
        }
        // shell 可能晚于插件生效，延迟两帧再跑
        const raf = requestAnimationFrame(() => requestAnimationFrame(run))
        return () => {
          cancelAnimationFrame(raf)
        }
      }, 'dsh-mobile-xc: canary')

      // 3) reconciler 生命周期：单全树观察者 -> 脏键 -> 本核；仅窄屏激活
      const core = createReconcilerCore({
        requestFrame: (flush) => {
          let id = 0
          const run = (): void => {
            id = 0
            flush()
          }
          id = requestAnimationFrame(run)
          return () => {
            if (id !== 0) cancelAnimationFrame(id)
          }
        },
      })
      const toggleSidebar = makeSidebarToggle(ctx)
      registerDrawerTasks(core, toggleSidebar)
      registerComposerTasks(core)
      registerCompatTasks(core)
      installMobileEffect(ctx, 'dsh-mobile-xc: reconciler', () => {
        const observer = new MutationObserver((records) => {
          const keys = new Set<string>()
          for (const record of records) {
            keys.add(
              record.type === 'attributes' && record.attributeName !== null ? record.attributeName : '*',
            )
          }
          core.note(keys)
        })
        observer.observe(document.documentElement, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['style', 'class', 'data-sidebar-collapsed', 'data-details-collapsed'],
        })
        core.activate()
        return () => {
          observer.disconnect()
          core.deactivate()
        }
      })

      // 4) 交互层（Escape / 点外 / 导航自动关；窄屏装配）
      installOverlayInteractions(ctx, toggleSidebar)

      // 4.1) 手势层（swipe 一次性触发默认；跟手拖拽 GESTURE.dragEnabled 开启）
      installMobileGesture(ctx, toggleSidebar)

      // 5) 移动基线（viewport-fit=cover + 缩放抑制；focus-guard 防键盘弹起）
      installMobileEffect(ctx, 'dsh-mobile-xc: phone chrome', () => installPhoneChrome())
      installMobileEffect(ctx, 'dsh-mobile-xc: focus guard', () => installFocusGuard())
      installMobileEffect(ctx, 'dsh-mobile-xc: composer auto-collapse', () => installComposerAutoCollapse())

      // 6) ?mobile-nav-debug=1 徽标（返回 disposer 由 effect 持有）
      ctx.effect(() =>
        installDebugBadge(() => {
          const structural = checkStructuralAnchors(document)
          const hashed = checkHashedSelectors(document)
          const narrow = window.matchMedia(MOBILE_QUERY).matches
          const frameShape = structural.frameShape
          return (
            'view=' + window.innerWidth + 'px' +
            ' mq=' + (narrow ? 'narrow' : 'wide') +
            ' shell=' + (structural.shellOverlay ? 'ok' : 'MISS') +
            ' frame=' + (frameShape && structural.shellOverlay ? 'ok' : 'MISS') +
            ' composer=' + (structural.composerSlot ? 'ok' : 'MISS') +
            ' hash=' + hashed.hits + '/' + hashed.declared
          )
        }),
        'dsh-mobile-xc: debug badge',
      )

      // 7) 设置 → 插件 →「插件配置」tab 的配置卡（dshmarket 同款；异常不阻断加载）
      try {
        installXcPluginCard(ctx, react as unknown as { createElement(...a: unknown[]): unknown; useState<T>(i: T | (() => T)): [T, (v: T) => void]; useEffect(f: () => unknown, d: unknown[]): void; useRef<T>(i: T): { current: T } })
      } catch {
        /* 忽略 */
      }

    }

    exports.apply = apply
    exports.disablePwa = disablePwa
    // 声明所需客户端服务面（由运行时注入为 ctx 属性）
    exports.inject = ['slots', 'locale', 'settingsScope']
    return module.exports
  },
})