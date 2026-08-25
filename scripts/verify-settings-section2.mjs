#!/usr/bin/env node
/* 验证 v7：带诊断的设置区块检查 */
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
  const port = 8700 + Math.floor(Math.random() * 90)
  const ud = mkdtempSync(join(tmpdir(), 'dsh-xc-set2-'))
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
    await evalJs("document.querySelector('[data-mobile-nav=\"ham\"]')?.click()")
    await new Promise(x => setTimeout(x, 600))
    console.log('drawer open:', await evalJs("!document.querySelector('[data-shell-overlay]').parentElement.hasAttribute('data-sidebar-collapsed')"))
    const trig = await evalJs("(()=>{var b=document.querySelector('[data-mobile-nav=\"drawer\"] .VOzbGW_trigger')||document.querySelector('[data-mobile-nav=\"drawer\"] [aria-label*=\u0022\u8bbe\u7f6e\u0022]');if(!b)return null;var r=b.getBoundingClientRect();return {cls:(b.className||'').toString().slice(0,50),txt:(b.textContent||'').trim().slice(0,10),x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2),vis:r.width>0&&r.height>0}})()")
    console.log('设置 trigger:', JSON.stringify(trig))
    if (trig) {
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: trig.x, y: trig.y, button: 'left', clickCount: 1, pointerType: 'touch' })
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: trig.x, y: trig.y, button: 'left', clickCount: 1, pointerType: 'touch' })
      await new Promise(x => setTimeout(x, 900))
    }
    console.log('dialog 存在:', await evalJs("!!document.querySelector('[role=\"dialog\"][aria-modal]')"))
    const rows = await evalJs("(()=>{var out=[];[...document.querySelectorAll('[role=\"dialog\"] button')].forEach(function(b){var t=(b.textContent||'').trim();if(t)out.push(t.slice(0,10))});return out})()")
    console.log('dialog 按钮文本:', JSON.stringify(rows))
    const mobile = await evalJs("(()=>{var el=[...document.querySelectorAll('[role=\"dialog\"] button')].find(function(b){return (b.textContent||'').trim()==='\u79fb\u52a8\u7aef'});if(!el)return false;el.click();return true})()")
    console.log('点移动端:', mobile)
    await new Promise(x => setTimeout(x, 500))
    const labels = await evalJs("(()=>{var l=[];[...document.querySelectorAll('[role=\"dialog\"] label')].forEach(function(x){var t=(x.textContent||'').trim();if(/\u8ddf\u624b|dshmarket|PWA/.test(t))l.push(t.slice(0,30))});return l})()")
    console.log('移动端区块 switch 行:', JSON.stringify(labels, null, 1))
  } finally { try { ws?.close() } catch {}; child.kill() }
}
main().catch(e => { console.error('fail:', e.message); process.exit(1) })
