#!/usr/bin/env node
/* 验证 v6：设置面板出现「移动端」区块与开关（v0.3.0） */
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
  const port = 8800 + Math.floor(Math.random() * 90)
  const ud = mkdtempSync(join(tmpdir(), 'dsh-xc-set-'))
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
    // 打开设置（VOzbGW_trigger 已在抽屉；沿触发链：先开抽屉点设置）
    await evalJs("document.querySelector('[data-mobile-nav=\"ham\"]')?.click()")
    await new Promise(x => setTimeout(x, 500))
    const opened = await evalJs("(()=>{var b=document.querySelector('[data-mobile-nav=\"drawer\"] .VOzbGW_trigger');if(!b)return false;b.click();return true})()")
    console.log('设置已点开:', opened)
    await new Promise(x => setTimeout(x, 800))
    const rows = await evalJs("(()=>{var out=[];[...document.querySelectorAll('[role=\"dialog\"] [class*=\"navCell\"], [role=\"dialog\"] nav button,[role=\"dialog\"] [class*=\"nav\"] button')].forEach(function(b){var t=(b.textContent||'').trim();if(t)out.push(t.slice(0,12))});return out})()")
    console.log('设置导航行:', JSON.stringify(rows))
    const mobileRow = await evalJs("(()=>{var el=[...document.querySelectorAll('[role=\"dialog\"] button')].find(function(b){return (b.textContent||'').trim()==='移动端'});if(!el)return false;el.click();return true})()")
    console.log('点「移动端」行:', mobileRow)
    await new Promise(x => setTimeout(x, 600))
    const checks = await evalJs("(()=>{var labels=[];[...document.querySelectorAll('[role=\"dialog\"] label')].forEach(function(l){var t=(l.textContent||'').trim();if(/跟手拖拽|dshmarket|PWA/.test(t))labels.push(t.slice(0,30))});return labels})()")
    console.log('移动端区块开关行:', JSON.stringify(checks, null, 1))
  } finally { try { ws?.close() } catch {}; child.kill() }
}
main().catch(e => { console.error('fail:', e.message); process.exit(1) })
