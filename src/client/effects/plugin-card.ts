/**
 * plugin-card — 在「设置 → 插件 → 可配置」注册 dsh-mobile-xc 配置卡（dshmarket 同款机制）。
 * 命名空间若只注册 schema 而没有卡，可配置 tab 不会渲染任何东西；
 * 本模块按 settings.plugin.item 的 keyed 契约注册卡组件（key = 命名空间）。
 * 全链路形状防御 + try/catch：任何异常不影响插件 entry 加载。
 */

import { resolveSettingsValue } from '../config.ts'

interface Reactish {
  createElement(type: unknown, props: Record<string, unknown> | null, ...children: unknown[]): unknown
  useState<T>(init: T | (() => T)): [T, (v: T) => void]
  useEffect(fn: () => unknown, deps: unknown[]): void
  useRef<T>(init: T): { current: T }
}

interface ScopeLike {
  getSnapshot(): unknown
  set(field: string, value: unknown): Promise<unknown> | unknown
  subscribe(listener: () => void): () => void
}

interface SlotsFace {
  inject(name: string, factory: () => unknown): unknown
  register(options: Record<string, unknown>, component: unknown): unknown
}

interface SettingsScopeFace {
  bind(o: { namespace: string }): ScopeLike
}

interface CtxFace {
  slots?: unknown
  settingsScope?: unknown
  get?(name: string): unknown
  effect(fn: () => unknown, label?: string): unknown
}

const XC_NS = 'dsh-mobile-xc'

const FIELDS: Array<{ key: string; label: string; hint: string }> = [
  { key: 'dragEnabled', label: '跟手拖拽', hint: '开启后抽屉随手指拖动，松手按速度/位移吸附' },
  { key: 'dshmarketNavFix', label: 'dshmarket 设置导航修复', hint: '窄屏保留设置导航，防止市场页死路' },
  { key: 'pwaEnabled', label: 'PWA 离线缓存', hint: '关闭后立即卸载缓存，页面走网络' },
]

const rowClass = 'dsh-xc-srow'
const textClass = 'dsh-xc-srow-text'
const titleClass = 'dsh-xc-srow-title'
const hintClass = 'dsh-xc-srow-hint'
const swClass = 'dsh-xc-switch'

export function installXcPluginCard(ctx: unknown, react: Reactish): void {
  try {
    const face = ctx as CtxFace
    const slots = (face.slots ?? (typeof face.get === 'function' ? face.get('slots') : undefined)) as SlotsFace | undefined
    const scopeFace = (face.settingsScope ?? (typeof face.get === 'function' ? face.get('settingsScope') : undefined)) as SettingsScopeFace | undefined
    if (slots === undefined || typeof slots.inject !== 'function') return
    if (scopeFace === undefined || typeof scopeFace.bind !== 'function') return
    let scope: ScopeLike | null = null
    try {
      scope = scopeFace.bind({ namespace: XC_NS })
    } catch {
      return
    }
    const s = scope
    if (s === null || typeof s.getSnapshot !== 'function' || typeof s.set !== 'function') return

    const CardComponent = (): unknown => {
      const [open, setOpen] = react.useState<boolean>(false)
      const read = (): Record<string, boolean> => {
        try {
          const v = resolveSettingsValue(s.getSnapshot())
          return v !== undefined && v !== null && typeof v === 'object' ? (v as Record<string, boolean>) : {}
        } catch {
          return {}
        }
      }
      const [values, setValues] = react.useState<Record<string, boolean>>(read)
      const dirtyRef = react.useRef<boolean>(false)
      react.useEffect(() => {
        let alive = true
        const sync = (): void => {
          if (!alive) return
          try {
            const v = read()
            if (v !== undefined && v !== null && Object.keys(v).length > 0) setValues(v)
          } catch {
            /* 忽略 */
          }
        }
        // 迟到播种：settings 服务可能在 mount 时尚未 publish 完，稍后再取权威值
        sync()
        const timer = window.setTimeout(sync, 400)
        const off =
          typeof s.subscribe === 'function'
            ? s.subscribe(() => {
                // 用户手动改过则保留本地值；未改过才用权威快照纠正（如配置文件已为 true）
                if (!dirtyRef.current) sync()
              })
            : null
        return () => {
          alive = false
          window.clearTimeout(timer)
          if (off !== null) {
            try {
              off()
            } catch {
              /* 忽略 */
            }
          }
        }
      }, [])
      const toggle = (key: string, checked: boolean): void => {
        dirtyRef.current = true
        // 本地乐观翻转：立即改变 UI 状态（设置服务写入为异步）
        try {
          setValues({ ...values, [key]: checked })
        } catch {
          /* 忽略 */
        }
        try {
          const pr = s.set(key, checked) as Promise<unknown> | undefined
          if (pr !== undefined && pr !== null && typeof (pr as { then?: unknown }).then === 'function') {
            // 成功：保持乐观值（一致性交由订阅推送）；失败：重读快照回滚
            void (pr as Promise<unknown>).catch(() => {
              try {
                setValues(read())
              } catch {
                /* 忽略 */
              }
            })
          }
          // 同步返回（无 promise）：乐观值即终态
        } catch {
          /* 写入失败忽略 */
        }
      }
      const rows = FIELDS.map((f) => {
        const on = values[f.key] === true
        return react.createElement(
          'label',
          {
            key: f.key,
            className: rowClass,
            'data-xc-row': f.key,
          },
          react.createElement(
            'span',
            { className: textClass },
            react.createElement('span', { className: titleClass }, f.label),
            react.createElement('span', { className: hintClass }, f.hint),
          ),
          react.createElement(
            'span',
            { className: swClass + (on ? ' on' : '') },
            react.createElement('input', {
              type: 'checkbox',
              checked: on,
              onChange: (e: { target: { checked: boolean } }) => toggle(f.key, e.target.checked),
            }),
            react.createElement('span', { className: 'dsh-xc-switch-track' }),
            react.createElement('span', { className: 'dsh-xc-switch-thumb' }),
          ),
        )
      })
      // 官方 PluginCard 卡壳（YyYd_a_* 由 settings-plugins 注入全局可用）
      return react.createElement(
        'li',
        { className: 'YyYd_a_card' + (open ? ' YyYd_a_cardOpen' : ''), 'data-xc-card': true },
        react.createElement(
          'button',
          {
            type: 'button',
            className: 'YyYd_a_header',
            'aria-expanded': open ? 'true' : 'false',
            'aria-label': (open ? 'Collapse' : 'Expand') + ': dsh-mobile-xc',
            onClick: () => setOpen(!open),
          },
          react.createElement(
            'span',
            { className: 'YyYd_a_headText' },
            react.createElement('span', { className: 'YyYd_a_name' }, 'dsh-mobile-xc'),
            react.createElement('span', { className: 'YyYd_a_description' }, '移动端适配选项：跟手拖拽 / dshmarket 兼容 / PWA'),
          ),
          react.createElement(
            'svg',
            {
              className: 'YyYd_a_chevron' + (open ? ' YyYd_a_chevronOpen' : ''),
              width: '14',
              height: '14',
              viewBox: '0 0 16 16',
              fill: 'none',
              'aria-hidden': 'true',
            },
            react.createElement('path', { d: 'M3 6L8 11L13 6', stroke: 'currentColor', strokeWidth: '1.5', strokeLinecap: 'round', strokeLinejoin: 'round' }),
          ),
        ),
        open
          ? react.createElement('div', { className: 'YyYd_a_body' }, ...rows)
          : null,
      )
    }

    face.effect(() => {
      // 行样式（主题 token；随卡生命周期注入/移除）
      const styleTag = document.createElement('style')
      styleTag.dataset.pluginCss = '@dsh-mobile-xc/card'
      styleTag.textContent = [
        '.dsh-xc-srow{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;border-top:1px solid var(--dsw-alias-border-l1,#2a3342);cursor:pointer}',
        '.dsh-xc-srow:first-child{border-top:none}',
        '.dsh-xc-srow-text{display:flex;flex-direction:column;gap:2px;min-width:0;padding-right:8px}',
        '.dsh-xc-srow-title{font-size:13px;line-height:18px;color:var(--dsw-alias-label-primary,#e2e8f0);font-weight:500}',
        '.dsh-xc-srow-hint{font-size:12px;line-height:16px;color:var(--dsw-alias-label-caption,#94a3b8)}',
        '.dsh-xc-switch{position:relative;width:40px;height:24px;flex:none;border-radius:12px;background:var(--dsw-alias-border-l2,#3b4557);transition:background .18s var(--ds-ease-in-out,ease)}',
        '.dsh-xc-switch.on{background:var(--dsw-alias-button-info-fill,#3b82f6)}',
        '.dsh-xc-switch input{position:absolute;inset:0;opacity:0;margin:0;cursor:pointer}',
        '.dsh-xc-switch-thumb{position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.35);transition:transform .18s var(--ds-ease-in-out,ease);pointer-events:none}',
        '.dsh-xc-switch.on .dsh-xc-switch-thumb{transform:translateX(16px)}'
      ].join('')
      document.head.appendChild(styleTag)
      
      // 官方形状：工厂用 generator（keyed 槽位按此分发）
      const remove = slots.inject('settings.plugin.item', function* () {
        yield slots.register(
          {
            name: 'settings.plugin.item',
            key: XC_NS,
            label: () => XC_NS,
          },
          CardComponent,
        )
      })
      return () => {
        styleTag.remove()
        if (remove !== undefined && remove !== null && typeof remove === 'function') {
          try {
            ;(remove as () => void)()
          } catch {
            /* 忽略 */
          }
        }
      }
    }, 'dsh-mobile-xc: plugin config card')
  } catch {
    /* 任何异常都不阻断插件加载 */
  }
}