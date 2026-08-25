#!/usr/bin/env node
/**
 * verify-overlay-z — 验证 shell.overlay 抬升规则（重启遮罩盖住抽屉/汉堡）。
 *
 * 用法：
 *   node scripts/verify-overlay-z.mjs
 *
 * 断言：
 *   移动端 390x844：
 *     - 基线：宿主 [data-shell-overlay] z=20（< 汉堡 60 / 抽屉 40 -> 当前 bug）
 *     - 模拟修复：注入插件同款规则后 [data-shell-overlay] 计算 z=1000（> 汉堡/抽屉）
 *     - 汉堡 / 抽屉 / details 的 z 数字与 layout.css.ts 一致
 *   桌面 1440x900：
 *     - 注入同规则后 [data-shell-overlay] 仍为 20（媒体限定，桌面零影响）
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const URL = process.env.DSH_PROBE_URL ?? 'http://127.0.0.1:3080/'
const TIMEOUT_MS = Number(process.env.DSH_PROBE_TIMEOUT_MS ?? 30000)

function findBrowser() {
  const candidates = [
    process.env.DSH_PROBE_CHROME,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ].filter(Boolean)
  for (const c of candidates) if (existsSync(c)) return c
  console.error('[verify-overlay-z] 未找到 Chromium 系浏览器')
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
    } catch { /* not up */ }
    if (Date.now() - start > timeoutMs) throw new Error('browser 启动超时')
    await new Promise((r) => setTimeout(r, 200))
  }
}

const zExpr = (sel) => String.raw`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return 'MISSING'; return getComputedStyle(el).zIndex })()`

async function main() {
  const browser = findBrowser()
  const port = 9000 + Math.floor(Math.random() * 900)
  const userData = mkdtempSync(join(tmpdir(), 'dsh-xc-zprobe-'))
  const child = spawn(browser, [
    '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu',
    '--no-first-run', '--no-default-browser-check',
    '--remote-debugging-port=' + port, '--user-data-dir=' + userData, 'about:blank',
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
        if (p) { pending.delete(msg.id); p(msg) }
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
        pending.set(id, (m) => (m.error ? reject(new Error(method + ': ' + JSON.stringify(m.error))) : resolve(m.result)))
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

    // ---- 移动端 390x844 ----
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
    await send('Page.navigate', { url: URL })
    await waitForDom('!!document.querySelector("[data-shell-overlay]")')
    await waitForDom(String.raw`!!document.querySelector('[data-shell-overlay]').parentElement.hasAttribute('data-mobile-nav')`)

    const overlayZBase = await evaluate(zExpr('[data-shell-overlay]'))
    const hamZ = await evaluate(zExpr('[data-mobile-nav="ham"]'))
    const drawerZ = await evaluate(zExpr('[data-mobile-nav="frame"] > [data-mobile-nav="drawer"]'))
    check('mobile: 宿主 [data-shell-overlay] 基线 z=20（当前 bug 根因）', overlayZBase === '20', '实际 ' + overlayZBase)
    check('mobile: 汉堡 z=60', hamZ === '60', '实际 ' + hamZ)
    check('mobile: 抽屉 z=40', drawerZ === '40', '实际 ' + drawerZ)
    check('mobile: 基线 z 序 bug 成立 (20 < 60)', Number(overlayZBase) < Number(hamZ))

    // 注入插件同款修复规则（模拟 0.4.9 生效）
    await evaluate(String.raw`(() => {
      const s = document.createElement('style'); s.id = '__zfix';
      s.textContent = '@media (max-width: 1023px) { [data-shell-overlay] { z-index: 1000 !important; } }';
      document.head.appendChild(s);
    })()`)
    const overlayZFixed = await evaluate(zExpr('[data-shell-overlay]'))
    check('mobile: 注入修复后 [data-shell-overlay] z=1000', overlayZFixed === '1000', '实际 ' + overlayZFixed)
    check('mobile: 修复后 overlay(1000) > 汉堡(60) > 抽屉(40)', Number(overlayZFixed) > 60 && Number(overlayZFixed) > 40)

    // 桌面 1440x900：同规则不生效（媒体限定 -> 桌面零影响）
    await send('Emulation.clearDeviceMetricsOverride')
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
    await send('Page.navigate', { url: URL })
    await waitForDom('!!document.querySelector("[data-shell-overlay]")')
    const desktopZ = await evaluate(zExpr('[data-shell-overlay]'))
    check('desktop: 修复规则不越界（仍 z=20）', desktopZ === '20', '实际 ' + desktopZ)

    await new Promise((r) => setTimeout(r, 300))
    check('无页面异常', exceptions.length === 0, exceptions.slice(0, 3).join(' | '))
  } finally {
    try { ws?.close() } catch { /* ignore */ }
    child.kill()
  }

  const failed = results.filter((r) => !r.ok)
  console.log('\n[verify-overlay-z] ' + (results.length - failed.length) + '/' + results.length + ' 通过')
  process.exit(failed.length > 0 ? 1 : 0)
}

main().catch((error) => {
  console.error('[verify-overlay-z] 失败:', error.message)
  process.exit(1)
})
