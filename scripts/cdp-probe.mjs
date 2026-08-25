#!/usr/bin/env node
/**
 * cdp-probe — 无头 CDP 断点矩阵几何门禁（M1 首版）。
 *
 * 用法：
 *   node scripts/cdp-probe.mjs --expect=plugin    # 需 dsh web 运行且本机 profile 已装 dsh-mobile-xc
 *   node scripts/cdp-probe.mjs --expect=baseline  # 无插件：仅验证 CDP 链路与 shell 就绪（冒烟）
 *
 * 环境变量：
 *   DSH_PROBE_URL        默认 http://127.0.0.1:3080/
 *   DSH_PROBE_CHROME     浏览器可执行文件路径（否则自动探测 msedge/chrome）
 *   DSH_PROBE_TIMEOUT_MS 等待 DOM 超时（默认 30000）
 *
 * 断言（plugin 模式）：
 *   移动端 390x844：frame 标记 / drawer 标注 / 汉堡 44px / 点开->transform:none+scrim 可见 /
 *   点关->collapsed 恢复+scrim 隐藏 / 无页面错误
 *   桌面 1440x900：无 data-mobile-nav 标记 / 注入节点被移除 / 无页面错误
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const EXPECT = process.argv.find((a) => a.startsWith('--expect='))?.split('=')[1] ?? 'plugin'
const BASE = 'http://127.0.0.1:3080/'
const URL = process.env.DSH_PROBE_URL ?? BASE
const TIMEOUT_MS = Number(process.env.DSH_PROBE_TIMEOUT_MS ?? 30000)

function findBrowser() {
  const candidates = [
    process.env.DSH_PROBE_CHROME,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ].filter(Boolean)
  for (const c of candidates) {
    if (existsSync(c)) return c
  }
  console.error('[cdp-probe] 未找到 Chromium 系浏览器，设置 DSH_PROBE_CHROME')
  process.exit(2)
}

const results = []
function check(label, ok, detail = '') {
  results.push({ label, ok })
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + label + (detail ? '  [' + detail + ']' : ''))
}

async function waitFor(port, timeoutMs) {
  const start = Date.now()
  for (;;) {
    try {
      const res = await fetch('http://127.0.0.1:' + port + '/json/version')
      if (res.ok) return await res.json()
    } catch {
      /* not up yet */
    }
    if (Date.now() - start > timeoutMs) throw new Error('browser 启动超时')
    await new Promise((r) => setTimeout(r, 200))
  }
}

async function main() {
  const browser = findBrowser()
  const port = 9000 + Math.floor(Math.random() * 900)
  const userData = mkdtempSync(join(tmpdir(), 'dsh-xc-probe-'))
  const child = spawn(browser, [
    '--headless=new',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--remote-debugging-port=' + port,
    '--user-data-dir=' + userData,
    'about:blank',
  ], { stdio: 'ignore' })

  let ws = null
  try {
    const version = await waitFor(port, 15000)
    const pages = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json()
    const page = pages.find((t) => t.type === 'page')
    ws = new WebSocket(page.webSocketDebuggerUrl)
    await new Promise((resolve, reject) => {
      ws.onopen = resolve
      ws.onerror = () => reject(new Error('WebSocket 连接失败'))
    })

    let msgId = 0
    const pending = new Map()
    const exceptions = []
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data)
      if (msg.id !== undefined) {
        const p = pending.get(msg.id)
        if (p) {
          pending.delete(msg.id)
          p(msg)
        }
        return
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        const d = msg.params.exceptionDetails
        exceptions.push((d && d.exception && d.exception.description) || String(d && d.text))
      }
    }
    const send = (method, params = {}) =>
      new Promise((resolve, reject) => {
        const id = ++msgId
        pending.set(id, (msg) => (msg.error ? reject(new Error(method + ': ' + JSON.stringify(msg.error))) : resolve(msg.result)))
        ws.send(JSON.stringify({ id, method, params }))
      })
    const evaluate = async (expression) => {
      const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
      if (res.exceptionDetails) throw new Error('evaluate 抛错: ' + (res.exceptionDetails.exception?.description ?? res.exceptionDetails.text))
      return res.result?.value
    }
    const waitForDom = async (expression, timeoutMs = TIMEOUT_MS) => {
      const start = Date.now()
      for (;;) {
        if (await evaluate(expression)) return true
        if (Date.now() - start > timeoutMs) return false
        await new Promise((r) => setTimeout(r, 250))
      }
    }

    await send('Runtime.enable')
    await send('Page.enable')

    if (EXPECT === 'plugin') {
      // ---- 移动端 390x844 ----
      await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
      await send('Page.navigate', { url: URL + '?mobile-nav-debug=1' })
      await waitForDom('!!document.querySelector("[data-shell-overlay]")')
      await waitForDom('!!document.querySelector("[data-shell-overlay]").parentElement.hasAttribute("data-mobile-nav")')

      check('mobile: frame 标记存在', await evaluate(String.raw`!!document.querySelector('[data-shell-overlay]').parentElement.hasAttribute('data-mobile-nav')`))
      check('mobile: drawer 已标注', await evaluate(String.raw`!!document.querySelector('[data-mobile-nav="frame"] > [data-mobile-nav="drawer"]')`))
      check('mobile: 汉堡存在且 44px', await evaluate(String.raw`(() => { const h = document.querySelector('[data-mobile-nav="ham"]'); if (!h) return false; const r = h.getBoundingClientRect(); return r.width >= 44 && r.height >= 44 })()`))

      // 点开
      await evaluate(String.raw`document.querySelector('[data-mobile-nav="ham"]').click()`)
      await waitForDom(String.raw`!document.querySelector('[data-shell-overlay]').parentElement.hasAttribute('data-sidebar-collapsed')`)
      await new Promise((r) => setTimeout(r, 400))
      check('mobile: 打开后抽屉 transform:none', await evaluate(String.raw`getComputedStyle(document.querySelector('[data-mobile-nav="frame"] > [data-mobile-nav="drawer"]')).transform === 'none'`))
      check('mobile: 打开后遮罩可见', await evaluate(String.raw`getComputedStyle(document.querySelector('[data-mobile-nav="scrim"]')).display === 'block'`))

      // 点关（遮罩）
      await evaluate(String.raw`document.querySelector('[data-mobile-nav="scrim"]').click()`)
      await waitForDom(String.raw`document.querySelector('[data-shell-overlay]').parentElement.hasAttribute('data-sidebar-collapsed')`)
      await new Promise((r) => setTimeout(r, 400))
      check('mobile: 关闭后遮罩隐藏', await evaluate(String.raw`getComputedStyle(document.querySelector('[data-mobile-nav="scrim"]')).display === 'none'`))

      // composer 几何断言（M2 一行契约：add 28 / send 34 / 无重叠）
      check('mobile: add=28px', await evaluate(String.raw`(() => { const el = document.querySelector('.uV2eYG_add'); if (!el) return false; const r = el.getBoundingClientRect(); return Math.abs(r.width - 28) < 1 && Math.abs(r.height - 28) < 1 })()`))
      check('mobile: send=34px', await evaluate(String.raw`(() => { const el = document.querySelector('.uV2eYG_primary'); if (!el) return false; const r = el.getBoundingClientRect(); return Math.abs(r.width - 34) < 1 && Math.abs(r.height - 34) < 1 })()`))
      check('mobile: add/send 无重叠', await evaluate(String.raw`(() => { const a = document.querySelector('.uV2eYG_add')?.getBoundingClientRect(); const b = document.querySelector('.uV2eYG_primary')?.getBoundingClientRect(); if (!a || !b) return false; return !(a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top) })()`))

      // ---- 桌面 1440x900 ----
      await send('Emulation.clearDeviceMetricsOverride')
      await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
      await send('Page.navigate', { url: URL })
      await waitForDom('!!document.querySelector("[data-shell-overlay]")')
      await waitForDom(String.raw`!document.querySelector('[data-shell-overlay]').parentElement.hasAttribute('data-mobile-nav')`)

      check('desktop: 无 frame 标记（零影响）', await evaluate(String.raw`!document.querySelector('[data-shell-overlay]').parentElement.hasAttribute('data-mobile-nav')`))
      check('desktop: 注入节点已移除', await evaluate(String.raw`document.querySelectorAll('[data-mobile-nav="ham"], [data-mobile-nav="scrim"]').length === 0`))
    } else {
      // ---- baseline：无插件冒烟 ----
      await send('Page.navigate', { url: URL })
      const shellOk = await waitForDom('!!document.querySelector("[data-shell-overlay]")')
      check('baseline: shell 就绪', shellOk)
      check('baseline: 无插件标记', await evaluate(String.raw`document.querySelectorAll('[data-mobile-nav]').length === 0`))
    }

    await new Promise((r) => setTimeout(r, 300))
    check('无页面异常', exceptions.length === 0, exceptions.slice(0, 3).join(' | '))
  } finally {
    try {
      ws?.close()
    } catch {
      /* ignore */
    }
    child.kill()
  }

  const failed = results.filter((r) => !r.ok)
  console.log('\n[cdp-probe] ' + (results.length - failed.length) + '/' + results.length + ' 通过 (expect=' + EXPECT + ')')
  process.exit(failed.length > 0 ? 1 : 0)
}

main().catch((error) => {
  console.error('[cdp-probe] 失败:', error.message)
  process.exit(1)
})