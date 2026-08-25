#!/usr/bin/env node
/* dev 诊断 2：真实输入序列（mousedown/up）点击抽屉树节点，观察抽屉状态/展开/会话切换 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const URL = process.env.DSH_PROBE_URL ?? 'http://127.0.0.1:3080/'
function findBrowser() {
  const cands = [process.env.DSH_PROBE_CHROME,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'].filter(Boolean)
  for (const c of cands) if (existsSync(c)) return c
  throw new Error('no browser')
}
async function waitPort(port, ms) {
  const t0 = Date.now()
  for (;;) {
    try { const res = await fetch('http://127.0.0.1:' + port + '/json/version'); if (res.ok) return } catch {}
    if (Date.now() - t0 > ms) throw new Error('timeout')
    await new Promise(r => setTimeout(r, 200))
  }
}
async function main() {
  const browser = findBrowser()
  const port = 9900 + Math.floor(Math.random() * 90)
  const userData = mkdtempSync(join(tmpdir(), 'dsh-xc-tap-'))
  const child = spawn(browser, ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-first-run', '--remote-debugging-port=' + port, '--user-data-dir=' + userData, 'about:blank'], { stdio: 'ignore' })
  let ws = null
  try {
    await waitPort(port, 15000)
    const pages = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json()
    ws = new WebSocket(pages.find(t => t.type === 'page').webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws')) })
    let id = 0
    const pending = new Map()
    ws.onmessage = ev => { const msg = JSON.parse(ev.data); if (msg.id !== undefined) { const f = pending.get(msg.id); pending.delete(msg.id); f && f(msg) } }
    const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, m => m.error ? rej(new Error(method)) : res(m.result)); ws.send(JSON.stringify({ id: i, method, params })) })
    const evalJs = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.value
    await send('Runtime.enable')
    await send('Page.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
    await send('Page.navigate', { url: URL })
    for (let i = 0; i < 60; i++) {
      if (await evalJs("!!document.querySelector('[data-shell-overlay]')&&!!document.querySelector('[data-shell-overlay]').parentElement.hasAttribute('data-mobile-nav')")) break
      await new Promise(r => setTimeout(r, 500))
    }
    await evalJs("document.querySelector('[data-mobile-nav=\"ham\"]')?.click()")
    await new Promise(r => setTimeout(r, 600))
    const drawerOpen = () => evalJs("!document.querySelector('[data-shell-overlay]').parentElement.hasAttribute('data-sidebar-collapsed')")
    console.log('drawer open:', await drawerOpen())

    // 坐标：可展开但未展开的行（expandedVal=false）中心
    const pt = await evalJs("(()=>{const el=document.querySelector('[data-mobile-nav=\"drawer\"] [role=\"treeitem\"][aria-expanded=\"false\"]');if(!el)return null;const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,text:(el.textContent||'').trim().slice(0,24)}})()")
    console.log('target row:', JSON.stringify(pt))
    if (!pt) { console.log('no expandable-closed row'); return }
    const tap = async () => {
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: pt.x, y: pt.y, button: 'left', clickCount: 1, pointerType: 'touch' })
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: pt.x, y: pt.y, button: 'left', clickCount: 1, pointerType: 'touch' })
    }
    await tap()
    await new Promise(r => setTimeout(r, 700))
    console.log('after tap #1 -> drawer open:', await drawerOpen())
    const s1 = await evalJs("(()=>{const el=document.querySelector('[data-mobile-nav=\"drawer\"] [role=\"treeitem\"][aria-expanded]'); if(!el)return '?' ; const t=el.textContent.trim().slice(0,20); return t+' | expanded='+el.getAttribute('aria-expanded')})()")
    console.log('first expandable row state after tap #1:', s1)

    // 再点一次（模拟双击第二击）
    await tap()
    await new Promise(r => setTimeout(r, 700))
    console.log('after tap #2 -> drawer open:', await drawerOpen())
    const s2 = await evalJs("(()=>{const el=document.querySelector('[data-mobile-nav=\"drawer\"] [role=\"treeitem\"].xc-probe-row-1, [data-mobile-nav=\"drawer\"] [role=\"treeitem\"][aria-expanded]'); if(!el)return '?' ; const t=el.textContent.trim().slice(0,20); return t+' | expanded='+el.getAttribute('aria-expanded')})()")
    console.log('row state after tap #2:', s2)
  } finally {
    try { ws?.close() } catch {}
    child.kill()
  }
}
main().catch(e => { console.error('tap probe failed:', e.message); process.exit(1) })
