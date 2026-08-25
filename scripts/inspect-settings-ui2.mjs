#!/usr/bin/env node
/* 插件页：dump dsh-mobile-xc 行与 dshmarket 行的结构（找配置卡入口） */
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
  const port = 8300 + Math.floor(Math.random() * 90)
  const ud = mkdtempSync(join(tmpdir(), 'dsh-xc-set5-'))
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
    const evalJs = async e => { const r2 = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); if (r2.exceptionDetails) return '__EXC__'; return r2.result?.value }
    await send('Runtime.enable')
    await send('Page.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1024, height: 900, deviceScaleFactor: 1, mobile: false })
    await send('Page.navigate', { url: URL })
    for (let i = 0; i < 90; i++) {
      if (await evalJs("!!document.querySelector('[data-shell-overlay]')")) break
      await new Promise(x => setTimeout(x, 500))
    }
    await evalJs("(()=>{var b=[...document.querySelectorAll('button')].find(function(x){return (x.textContent||'').trim()==='\u8bbe\u7f6e'});if(b)b.click();return true})()")
    await new Promise(x => setTimeout(x, 1200))
    // 点「插件」导航
    await evalJs("(()=>{var b=[...document.querySelectorAll('[aria-modal] button,[role=\"dialog\"] button')].find(function(x){return (x.textContent||'').trim()==='\u63d2\u4ef6'});if(b)b.click();return true})()")
    await new Promise(x => setTimeout(x, 1200))
    // dump 整页包含 dsh-mobile-xc / dshmarket 的元素祖先链
    const rows = await evalJs("(()=>{function anc(el,n){var a=[];for(var i=0;i<n&&el;i++){a.push({tag:el.tagName,cls:(el.className||'').toString().slice(0,60),txt:(el.textContent||'').trim().slice(0,24)});el=el.parentElement}return a}var out={};['dsh-mobile-xc','dshmarket'].forEach(function(k){var els=[...document.querySelectorAll('body *')].filter(function(e){return e.children.length===0&&(e.textContent||'').includes(k)});var target=els[0];out[k]=target?anc(target,5):null});return out})()")
    console.log('插件行定位:', JSON.stringify(rows, null, 1))
    // 找「允许重启 / allowRestart」开关是否存在
    const allow = await evalJs("(()=>{var els=[...document.querySelectorAll('body *')].filter(function(e){var t=(e.textContent||'').trim();return t.includes('dshmarket')&&(t.includes('\u5141\u8bb8\u91cd\u542f')||t.includes('allowRestart'))});return els.length?els[0].outerHTML.slice(0,500):null})()")
    console.log('dshmarket 卡:', allow)
    // 插件页有没有「配置」按钮/入口字样
    const cfgWords = await evalJs("(()=>{var words=['\u914d\u7f6e','\u8bbe\u7f6e','\u5f00\u542f','\u542f\u7528','Config'];var out=[];[...document.querySelectorAll('[aria-modal] button')].forEach(function(b){var t=(b.textContent||'').trim();if(t&&words.some(function(w){return t.includes(w)})&&t.length<20)out.push(t)});return out.filter(function(v,i,a){return a.indexOf(v)===i})})()")
    console.log('插件页按钮:', JSON.stringify(cfgWords))
  } finally { try { ws?.close() } catch {}; child.kill() }
}
main().catch(e => { console.error('fail:', e.message); process.exit(1) })
