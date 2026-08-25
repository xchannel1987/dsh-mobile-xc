#!/usr/bin/env node
/* dev 诊断：抽屉树节点结构 + 点击行为（v0.1.3+ 现场取证用） */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const URL = process.env.DSH_PROBE_URL ?? 'http://127.0.0.1:3080/'

function findBrowser() {
  const cands = [
    process.env.DSH_PROBE_CHROME,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
  ].filter(Boolean)
  for (const c of cands) if (existsSync(c)) return c
  throw new Error('no browser')
}

async function waitPort(port, ms) {
  const t0 = Date.now()
  for (;;) {
    try { const res = await fetch('http://127.0.0.1:' + port + '/json/version'); if (res.ok) return } catch {}
    if (Date.now() - t0 > ms) throw new Error('browser timeout')
    await new Promise(r => setTimeout(r, 200))
  }
}

async function main() {
  const browser = findBrowser()
  const port = 9800 + Math.floor(Math.random() * 100)
  const userData = mkdtempSync(join(tmpdir(), 'dsh-xc-inspect-'))
  const child = spawn(browser, ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-first-run', '--remote-debugging-port=' + port, '--user-data-dir=' + userData, 'about:blank'], { stdio: 'ignore' })
  let ws = null
  try {
    await waitPort(port, 15000)
    const pages = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json()
    const page = pages.find(t => t.type === 'page')
    ws = new WebSocket(page.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws fail')) })
    let id = 0
    const pending = new Map()
    ws.onmessage = ev => {
      const msg = JSON.parse(ev.data)
      if (msg.id !== undefined) { const f = pending.get(msg.id); pending.delete(msg.id); f && f(msg) }
    }
    const send = (method, params = {}) => new Promise((res, rej) => {
      const i = ++id
      pending.set(i, m => m.error ? rej(new Error(method + ':' + JSON.stringify(m.error))) : res(m.result))
      ws.send(JSON.stringify({ id: i, method, params }))
    })
    const evalJs = async (expression) => {
      const r2 = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
      return r2.result?.value
    }
    await send('Runtime.enable')
    await send('Page.enable')

    // 平台/认证环境说明：可能需要会话注入；先直接导航看 shell 是否就绪
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
    await send('Page.navigate', { url: URL })
    // 等 shell + 插件标记（插件打过 0.1.3 tgz）
    let ok = false
    for (let i = 0; i < 60; i++) {
      ok = await evalJs("!!document.querySelector('[data-shell-overlay]')&&!!document.querySelector('[data-shell-overlay]').parentElement.hasAttribute('data-mobile-nav')")
      if (ok) break
      await new Promise(r => setTimeout(r, 500))
    }
    console.log('shell+plugin ready:', ok)

    // 打开抽屉（点汉堡）
    await evalJs("document.querySelector('[data-mobile-nav=\"ham\"]')?.click()")
    await new Promise(r => setTimeout(r, 600))
    const open = await evalJs("!document.querySelector('[data-shell-overlay]').parentElement.hasAttribute('data-sidebar-collapsed')")
    console.log('drawer open after ham click:', open)

    // dump 树节点
    const rows = await evalJs("(()=>{const out=[];document.querySelectorAll('[data-mobile-nav=\"drawer\"] [role=\"treeitem\"]').forEach((r,i)=>{out.push({i, tag:r.tagName, expanded:r.hasAttribute('aria-expanded'), expandedVal:r.getAttribute('aria-expanded'), role:r.getAttribute('role'), hasBtn:!!r.querySelector('button'), text:(r.textContent||'').trim().slice(0,30)})});return out.slice(0,40)})()")
    console.log('treeitem count:', Array.isArray(rows) ? rows.length : JSON.stringify(rows))
    if (Array.isArray(rows)) for (const r of rows.slice(0, 15)) console.log(JSON.stringify(r))

    // 若存在可展开节点：模拟点击，看抽屉是否被关闭（判断关闭来源）
    const expandedIdx = await evalJs("(()=>{const el=document.querySelector('[data-mobile-nav=\"drawer\"] [role=\"treeitem\"][aria-expanded]');return el?1:0})()")
    if (expandedIdx === 1) {
      await evalJs("document.querySelector('[data-mobile-nav=\"drawer\"] [role=\"treeitem\"][aria-expanded]').click()")
      await new Promise(r => setTimeout(r, 700))
      const stillOpen = await evalJs("!document.querySelector('[data-shell-overlay]').parentElement.hasAttribute('data-sidebar-collapsed')")
      console.log('after single-click expandable row -> drawer still open:', stillOpen)
    } else {
      console.log('no [aria-expanded] treeitem found in drawer')
    }
  } finally {
    try { ws?.close() } catch {}
    child.kill()
  }
}
main().catch(e => { console.error('inspect failed:', e.message); process.exit(1) })
