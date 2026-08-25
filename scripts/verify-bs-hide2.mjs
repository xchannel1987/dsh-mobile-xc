#!/usr/bin/env node
/* 诊断 v2：better-sidebar 结构 + 真实输入点按钮，观察面板开合与汉堡 */
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
  const port = 9500 + Math.floor(Math.random() * 90)
  const ud = mkdtempSync(join(tmpdir(), 'dsh-xc-bs2-'))
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

    // dump host + panel + buttons
    const info = await evalJs("(()=>{var host=document.querySelector('[data-dsh-panel-host]');var out={host:!!host,panel:null,btns:[]};if(!host)return out;var pp=host.querySelector('.nArs4W_panel');out.panel=pp?{hidden:pp.classList.contains('nArs4W_panelHidden'),cls:pp.className.slice(0,90)}:null;host.querySelectorAll('button').forEach(function(b,i){var r=b.getBoundingClientRect();out.btns.push({i:i,cls:(b.className||'').toString().slice(0,70),x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2),w:Math.round(r.width),h:Math.round(r.height)})});return out})()")
    console.log('info:', JSON.stringify(info))

    if (!info.host) { console.log('无 [data-dsh-panel-host]（better-sidebar 未渲染）'); return }
    // 逐个真实输入点按钮，看哪个能让面板去掉 panelHidden
    for (const b of info.btns.slice(0, 6)) {
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: b.x, y: b.y, button: 'left', clickCount: 1, pointerType: 'touch' })
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: b.x, y: b.y, button: 'left', clickCount: 1, pointerType: 'touch' })
      await new Promise(x => setTimeout(x, 450))
      const st = await evalJs("(()=>{var p=document.querySelector('[data-dsh-panel-host] .nArs4W_panel');return p?{hidden:p.classList.contains('nArs4W_panelHidden'),vis:getComputedStyle(p).visibility}:'(no panel)'})()")
      const ham = await evalJs("(()=>{var h=document.querySelector('.dsh-xc-ham');return h?getComputedStyle(h).display:'(no-ham)'})()")
      console.log('btn#' + b.i + ' [' + b.cls.slice(0, 30) + '] -> panel:', JSON.stringify(st), '| ham:', ham)
      if (!st.hidden) break
    }
  } finally { try { ws?.close() } catch {}; child.kill() }
}
main().catch(e => { console.error('fail:', e.message); process.exit(1) })
