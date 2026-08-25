#!/usr/bin/env node
/* 验证 v9：设置 -> 插件 -> 可配置 tab 出现 dsh-mobile-xc 卡（v0.3.4） */
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
  const port = 8200 + Math.floor(Math.random() * 90)
  const ud = mkdtempSync(join(tmpdir(), 'dsh-xc-card-'))
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
    await evalJs("(()=>{var b=[...document.querySelectorAll('button')].find(function(x){return (x.textContent||'').trim()==='\u8bbe\u7f6e'});if(b)b.click();return !!b})()")
    await new Promise(x => setTimeout(x, 1200))
    await evalJs("(()=>{var b=[...document.querySelectorAll('[aria-modal] button,[role=\"dialog\"] button')].find(function(x){return (x.textContent||'').trim()==='\u63d2\u4ef6'});if(b)b.click();return !!b})()")
    await new Promise(x => setTimeout(x, 1200))
    // 可配置 tab（文本「可配置」或「Configurable」）
    const tab = await evalJs("(()=>{var b=[...document.querySelectorAll('[aria-modal] button')].find(function(x){var t=(x.textContent||'').trim();return t==='\u53ef\u914d\u7f6e'||t==='Configurable'});if(b){b.click();return true}return false})()")
    console.log('可配置 tab 点击:', tab)
    await new Promise(x => setTimeout(x, 900))
    const card = await evalJs("(()=>{var all=[...document.querySelectorAll('[aria-modal] *')];var card=[...all].find(function(el){return el.children.length>0&&(el.textContent||'').includes('dsh-mobile-xc')&&(el.textContent||'').includes('\u8ddf\u624b')});if(!card)return null;var boxes=card.querySelectorAll('input[type=checkbox]');return {text:(card.textContent||'').trim().slice(0,120),checks:boxes.length,checked:[...boxes].map(function(b){return b.checked})}})()")
    console.log('dsh-mobile-xc 配置卡:', JSON.stringify(card, null, 1))
    // 尝试切换第一个开关并回读（验证写路径）
    if (card) {
      const before = card.checked
      await evalJs("(()=>{var c=document.querySelector('[aria-modal] strong');var card=[...document.querySelectorAll('[aria-modal] *')].find(function(el){return el.children.length>0&&(el.textContent||'').includes('dsh-mobile-xc')&&(el.textContent||'').includes('\u8ddf\u624b')});var box=card?card.querySelector('input[type=checkbox]'):null;if(box){box.click();return true}return false})()")
      await new Promise(x => setTimeout(x, 800))
      const after = await evalJs("(()=>{var card=[...document.querySelectorAll('[aria-modal] *')].find(function(el){return el.children.length>0&&(el.textContent||'').includes('dsh-mobile-xc')&&(el.textContent||'').includes('\u8ddf\u624b')});if(!card)return null;return [...card.querySelectorAll('input[type=checkbox]')].map(function(b){return b.checked})})()")
      console.log('切换后:', JSON.stringify(after), '(前:', JSON.stringify(before), ')')
    }
  } finally { try { ws?.close() } catch {}; child.kill() }
}
main().catch(e => { console.error('fail:', e.message); process.exit(1) })
