#!/usr/bin/env node
/* 取证：添加工作区入口 + 分组/排序菜单 DOM 与点击后抽屉状态 */
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
  const port = 9100 + Math.floor(Math.random() * 90)
  const ud = mkdtempSync(join(tmpdir(), 'dsh-xc-ws-'))
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

    // 1) 全页找「添加工作区」文本
    const addWs = await evalJs("(()=>{var els=[...document.querySelectorAll('body *')];var hit=els.find(function(el){return el.children.length===0 && /(添加工作区|Add workspace)/.test(el.textContent||'')});if(!hit)return null;var anc=[];var n=hit;for(var i=0;i<4&&n;i++){anc.push({tag:n.tagName,cls:(n.className||'').toString().slice(0,80),text:(n.textContent||'').trim().slice(0,24)});n=n.parentElement}return anc})()")
    console.log('添加工作区 入口祖先链:', JSON.stringify(addWs, null, 1))

    // 2) 找分组/排序菜单触发器（含「分组」或「排序」或 role=menu 元素）
    const options = await evalJs("(()=>{var out=[];document.querySelectorAll('[data-mobile-nav=\"drawer\"] button').forEach(function(b){var t=(b.textContent||'').trim();if(t.length<40)out.push({tag:b.tagName,cls:(b.className||'').toString().slice(0,60),text:t.slice(0,24),aria:b.getAttribute('aria-haspopup'),expanded:b.getAttribute('aria-expanded')})});var ms=document.querySelectorAll('[data-mobile-nav=\"drawer\"] [role=\"menu\"]');out.push({menuCount:ms.length});return out.slice(0,60)})()")
    console.log('抽屉内按钮 + 菜单数:', JSON.stringify(options))

    // 3) 若存在 role=menu：dump 菜单位置（是否在 body 下）与项文本
    const menuInfo = await evalJs("(()=>{var m=document.querySelector('body > [role=\"menu\"], body > div [role=\"menu\"]');if(!m)return null;var r=m.getBoundingClientRect();return {rect:{x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)},items:[...m.querySelectorAll('[role=\"menuitem\"],li,button')].slice(0,8).map(function(x){return (x.textContent||'').trim().slice(0,20)})}})()")
    console.log('页面级菜单:', JSON.stringify(menuInfo))
  } finally { try { ws?.close() } catch {}; child.kill() }
}
main().catch(e => { console.error('fail:', e.message); process.exit(1) })
