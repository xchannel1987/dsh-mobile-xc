#!/usr/bin/env node
/* 取证：添加工作区入口的真实形态（文本/aria-label/title，tag/role/类），并测点击后菜单 DOM */
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
  const port = 8900 + Math.floor(Math.random() * 90)
  const ud = mkdtempSync(join(tmpdir(), 'dsh-xc-ws3-'))
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

    // 1) 找「添加」相关按钮（含 aria-label/title/文本）
    const adds = await evalJs("(()=>{var out=[];[...document.querySelectorAll('[data-mobile-nav=\"drawer\"] button,[data-mobile-nav=\"drawer\"] [role=\"menuitem\"],[data-mobile-nav=\"drawer\"] a')].forEach(function(el){var txt=(el.textContent||'').trim();var aria=el.getAttribute('aria-label')||'';var title=el.getAttribute('title')||'';if(/\u6dfb\u52a0|Add/.test(txt+aria+title))out.push({tag:el.tagName,cls:(el.className||'').toString().slice(0,70),txt:txt.slice(0,24),aria:aria.slice(0,24),title:title.slice(0,24)})});return out})()")
    console.log('含「添加/Add」元素:', JSON.stringify(adds, null, 1))

    // 2) 点抽屉品牌区/工作区标题（打开工作区选择器）
    const brand = await evalJs("(()=>{var b=document.querySelector('[data-mobile-nav=\"drawer\"] .hHd-Xa_brand');if(!b)return null;var r=b.getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}})()")
    console.log('brand 按钮:', JSON.stringify(brand))
    if (brand) {
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: brand.x, y: brand.y, button: 'left', clickCount: 1, pointerType: 'touch' })
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: brand.x, y: brand.y, button: 'left', clickCount: 1, pointerType: 'touch' })
      await new Promise(x => setTimeout(x, 600))
      // 打开后：找含「添加工作区」文本/aria 的元素并 dump 祖先链
      const hit = await evalJs("(()=>{var found=null;[...document.querySelectorAll('body *')].forEach(function(el){if(found)return;var t=(el.textContent||'').trim();var a=el.getAttribute('aria-label')||'';if(/^(\u6dfb\u52a0\u5de5\u4f5c\u533a|Add workspace)/.test(t)||/^(\u6dfb\u52a0\u5de5\u4f5c\u533a|Add workspace)/.test(a))found=el});if(!found)return null;var anc=[];var n=found;for(var i=0;i<5&&n;i++){anc.push({tag:n.tagName,cls:(n.className||'').toString().slice(0,70),role:n.getAttribute('role'),txt:(n.textContent||'').trim().slice(0,20)});n=n.parentElement}return anc})()")
      console.log('选择器打开后「添加工作区」定位:', JSON.stringify(hit, null, 1))
    }
  } finally { try { ws?.close() } catch {}; child.kill() }
}
main().catch(e => { console.error('fail:', e.message); process.exit(1) })
