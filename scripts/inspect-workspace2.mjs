#!/usr/bin/env node
/* 取证2：逐个点抽屉按钮，找弹出「添加工作区」菜单的触发器，dump 菜单 DOM */
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
  const port = 9000 + Math.floor(Math.random() * 90)
  const ud = mkdtempSync(join(tmpdir(), 'dsh-xc-ws2-'))
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

    const btns = await evalJs("(()=>{var out=[];[...document.querySelectorAll('[data-mobile-nav=\"drawer\"] button')].forEach(function(b,i){var r=b.getBoundingClientRect();out.push({i:i,cls:(b.className||'').toString().slice(0,70),y:Math.round(r.y),text:(b.textContent||'').trim().slice(0,16)})});return out})()")
    console.log('抽屉按钮数:', btns.length)
    // 逐个点击（跳过 brand/toggle/新会话/power/设置），找含「添加工作区」的菜单
    for (const b of btns) {
      if (/brand|^hHd-Xa_toggle|newSession|dsh-power|VOzbGW/.test(b.cls)) continue
      await evalJs("(()=>{var bs=document.querySelectorAll('[data-mobile-nav=\"drawer\"] button');bs[" + b.i + "].click();return true})()")
      await new Promise(x => setTimeout(x, 260))
      const found = await evalJs("(()=>{var m=null;[...document.querySelectorAll('[role=\"menu\"], [role=\"menuitem\"]')].forEach(function(el){if((el.textContent||'').includes('添加工作区')||(el.textContent||'').includes('Add workspace'))m=el});if(!m)return null;var r=m.getBoundingClientRect();var anc=[];var n=m;for(var i=0;i<3&&n;i++){anc.push({tag:n.tagName,cls:(n.className||'').toString().slice(0,90),role:n.getAttribute('role')});n=n.parentElement}return {rect:{x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)},anc:anc,parentIsBody:anc[anc.length-1]&&anc[anc.length-1].tag==='BODY'}})()")
      if (found) {
        console.log('触发按钮 #' + b.i, '[' + b.cls + '] 弹出菜单:', JSON.stringify(found, null, 1))
        // 关闭菜单
        await evalJs("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))")
        await new Promise(x => setTimeout(x, 200))
        break
      }
      // 恢复：关掉可能已开的其它菜单
      await evalJs("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))")
      await new Promise(x => setTimeout(x, 150))
    }
  } finally { try { ws?.close() } catch {}; child.kill() }
}
main().catch(e => { console.error('fail:', e.message); process.exit(1) })
