#!/usr/bin/env node
/* 验证 v5：hover+click 触发渲染 -> 摘 panelHidden 断言 ham=none */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const URL = process.env.DSH_PROBE_URL ?? 'http://127.0.0.1:3080/'
function findBrowser() {
  const c = [process.env.DSH_PROBE_CHROME,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'].filter(Boolean)
  for (const x of c) if (existsSync(x)) return x
  throw new Error('no browser')
}
async function waitPort(port, ms) {
  const t0 = Date.now()
  for (;;) {
    try { const r = await fetch('http://127.0.0.1:' + port + '/json/version'); if (r.ok) return } catch {}
    if (Date.now() - t0 > ms) throw new Error('timeout')
    await new Promise(x => setTimeout(x, 200))
  }
}
async function main() {
  const browser = findBrowser()
  const port = 9200 + Math.floor(Math.random() * 90)
  const ud = mkdtempSync(join(tmpdir(), 'dsh-xc-bs5-'))
  const child = spawn(browser, ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-first-run', '--remote-debugging-port=' + port, '--user-data-dir=' + ud, 'about:blank'], { stdio: 'ignore' })
  let ws = null
  try {
    await waitPort(port, 15000)
    const pages = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json()
    ws = new WebSocket(pages.find(t => t.type === 'page').webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws')) })
    let id = 0
    const pend = new Map()
    ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id !== undefined) { const f = pend.get(m.id); pend.delete(m.id); f && f(m) } }
    const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, m => m.error ? rej(new Error(method)) : res(m.result)); ws.send(JSON.stringify({ id: i, method, params })) })
    const evalJs = async e => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.value
    await send('Runtime.enable')
    await send('Page.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
    await send('Page.navigate', { url: URL })
    for (let i = 0; i < 60; i++) {
      if (await evalJs("!!document.querySelector('[data-shell-overlay]')")) break
      await new Promise(x => setTimeout(x, 500))
    }
    // hover + click 切换按钮（触发面板懒渲染，与 v3 一致）
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 366, y: 57, pointerType: 'mouse' })
    await new Promise(x => setTimeout(x, 250))
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 366, y: 57, button: 'left', clickCount: 1, pointerType: 'mouse' })
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 366, y: 57, button: 'left', clickCount: 1, pointerType: 'mouse' })
    await new Promise(x => setTimeout(x, 800))
    const hasPanel = await evalJs("!!document.querySelector('[data-dsh-panel-host] .nArs4W_panel')")
    console.log('panel DOM 存在:', hasPanel)
    if (!hasPanel) { console.log('SKIP：懒渲染未触发'); return }
    const hamBefore = await evalJs("(()=>{var h=document.querySelector('.dsh-xc-ham');return h?getComputedStyle(h).display:'(no-ham)'})()")
    console.log('面板 hidden 时 ham:', hamBefore)
    // 摘掉隐藏类（模拟打开）
    await evalJs("(()=>{var p=document.querySelector('[data-dsh-panel-host] .nArs4W_panel');p.classList.remove('nArs4W_panelHidden');return true})()")
    await new Promise(x => setTimeout(x, 200))
    const ham = await evalJs("(()=>{var h=document.querySelector('.dsh-xc-ham');return h?getComputedStyle(h).display:'(no-ham)'})()")
    const hidden = await evalJs("document.querySelector('[data-dsh-panel-host] .nArs4W_panel').classList.contains('nArs4W_panelHidden')")
    console.log('面板打开(hidden=' + hidden + ') 时 ham:', ham)
    console.log('结果:', hidden === false && ham === 'none' ? 'PASS：面板打开 -> 汉堡隐藏' : 'FAIL')
  } finally { try { ws?.close() } catch {}; child.kill() }
}
main().catch(e => { console.error('fail:', e.message); process.exit(1) })
