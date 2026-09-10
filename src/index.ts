/**
 * dsh-mobile-xc — Host half（M5：PWA 面）。
 * 经 webServer 精确路由提供，不改任何 vendor 文件：
 *  /sw.js（no-cache，版本更新即时生效）、/manifest.webmanifest（遮蔽 dist 自带那份）、
 *  /pwa/icon-{192,512,180}.png（官方黑鲸鱼栅格化，immutable 缓存）、tapIndex 注入 SW 注册脚本。
 */
import type { Context } from '@deepseek-ai/cordis'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { HEAD_EXTRA, MANIFEST_JSON, SW_SOURCE } from './pwa.ts'
import z from '@deepseek-ai/schemastery'

export const name = 'dsh-mobile-xc'
export const inject = ['webServer'] as const

const ICON_SIZES = ['192', '512', '180'] as const

/**
 * 插件配置命名空间（dshmarket 同款：设置 -> 插件 -> dsh-mobile-xc 配置卡）。
 * 原用 @deepseek-ai/dsh-settings@0.1.1-rc.2 的 settingsNamespace() 品牌化；该包
 * 0.1.5 起宿主只保留 SettingsProvider 服务（顶层 helper 已移除、npm 停更于
 * 0.1.1-rc.2），命名空间本质是 lowercase-hyphen 字符串，此处本地化并断依赖。
 */
export const XC_SETTINGS_NS = 'dsh-mobile-xc'

/** 移动端配置 schema：滑动开抽屉 / dshmarket 兼容修复 / PWA / 抽屉刷新按钮。 */
export const XcSettings = z.object({
  swipeEnabled: z.boolean().default(true),
  dshmarketNavFix: z.boolean().default(true),
  pwaEnabled: z.boolean().default(true),
  drawerRefresh: z.boolean().default(false),
})

/**
 * settings 服务最小结构面（字符串名注入）。register(ns, schema, { base }) 契约
 * 在 0.1.1-rc.2 与 0.1.5-rc.1 之间未变，且注册绑定调用方 fiber（卸载自动注销）。
 * 服务端不消费配置变化（客户端经 settingsScope 订阅），因此不需要旧
 * installSettingsSection 的 watch/setSource 编排——内联最小等价实现即可。
 */
interface SettingsFace {
  register(ns: string, schema: unknown, options: { base?: unknown }): {
    get(): unknown
    watch(callback: (next: unknown, prev: unknown) => void): () => void
  }
}

/** 以 fiber 注入 settings 服务并登记命名空间；服务缺失时静默跳过。 */
function registerSettingsNamespace(ctx: Context, ns: string, schema: unknown, entry: Record<string, unknown>): void {
  const inject = ctx.inject as unknown as (names: string[], cb: (sctx: { settings?: SettingsFace }) => void) => void
  inject(['settings'], (sctx) => {
    const settings = sctx.settings
    if (settings === undefined || typeof settings.register !== 'function') return
    settings.register(ns, schema, { base: entry })
  })
}

interface ResFace {
  writeHead(code: number, headers?: Record<string, string>): void
  end(body?: string | Buffer): void
}

interface WsFace {
  register(options: {
    kind: 'exact'
    path: string
    handler: (req: unknown, res: ResFace) => void
  }): void
  tapIndex(fn: (html: string) => string): void
}

/** 以 effect 生命周期注册路由（回调恒返回 disposer，满足 cordis SyncEffect）。 */
const route = (effect: Context['effect'], label: string, fn: () => void): void => {
  effect(() => {
    fn()
    return () => {}
  }, label)
}

const readIcon = (size: string) =>
  readFile(fileURLToPath(new URL('../assets/pwa/icon-' + size + '.png', import.meta.url)))

export function apply(ctx: Context): void {
  // 插件配置卡（设置 -> 插件 -> dsh-mobile-xc）；无 settings 服务时静默跳过
  registerSettingsNamespace(ctx, XC_SETTINGS_NS, XcSettings, {})

  const ws = (ctx as unknown as { webServer?: WsFace }).webServer
  if (ws === undefined) return
  const effect = ctx.effect.bind(ctx)

  route(effect, 'dsh-mobile-xc: /sw.js', () => ws.register({
    kind: 'exact',
    path: '/sw.js',
    handler: (_req: unknown, res: ResFace) => {
      res.writeHead(200, {
        'content-type': 'text/javascript; charset=utf-8',
        'cache-control': 'no-cache',
      })
      res.end(SW_SOURCE)
    },
  }))

  route(effect, 'dsh-mobile-xc: /manifest.webmanifest', () => ws.register({
    kind: 'exact',
    path: '/manifest.webmanifest',
    handler: (_req: unknown, res: ResFace) => {
      res.writeHead(200, { 'content-type': 'application/manifest+json' })
      res.end(MANIFEST_JSON)
    },
  }))

  for (const size of ICON_SIZES) {
    route(effect, 'dsh-mobile-xc: /pwa/icon-' + size + '.png', () => ws.register({
      kind: 'exact',
      path: '/pwa/icon-' + size + '.png',
      handler: async (_req: unknown, res: ResFace) => {
        try {
          const body = await readIcon(size)
          res.writeHead(200, {
            'content-type': 'image/png',
            'cache-control': 'public, max-age=31536000, immutable',
          })
          res.end(body)
        } catch {
          res.writeHead(404)
          res.end()
        }
      },
    }))
  }

  route(effect, 'dsh-mobile-xc: pwa index tap', () => ws.tapIndex((html: string) => {
    if (html.includes('data-dsh-xc-pwa')) return html
    if (!html.includes('</head>')) return html + HEAD_EXTRA
    return html.replace('</head>', HEAD_EXTRA + '</head>')
  }))
}