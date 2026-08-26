#!/usr/bin/env node
/* 验证 v0.5.2：抽屉刷新按钮由配置 drawerRefresh 控制（默认隐藏；开启后显示）；配置卡含开关行 */
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
  const ud = mkdtempSync(join(tmpdir(), 'dsh-xc-ref-'))
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
    const evalJs = async e => { const r2 = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); if (r2.exceptionDetails) return '__EXC__: ' + (r2.exceptionDetails.exception?.description ?? ''); return r2.result?.value }
    await send('Runtime.enable')
    await send('Page.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
    await send('Page.navigate', { url: URL })
    const waitShell = async () => { for (let i = 0; i < 90; i++) { if (await evalJs("!!document.querySelector('[data-shell-overlay]')")) break; await new Promise(x => setTimeout(x, 500)) } }
    const hasRefresh = () => evalJs("!!document.querySelector('.dsh-xc-refresh')")

    await waitShell()
    await new Promise(x => setTimeout(x, 800))
    console.log('A. 默认状态下有刷新按钮:', await hasRefresh())
    await evalJs("document.querySelector('[data-mobile-nav=\"ham\"]')?.click()")
    await new Promise(x => setTimeout(x, 500))
    console.log('A. 开抽屉后存在刷新按钮:', await hasRefresh())

    await evalJs("localStorage.setItem('dsh-mobile-xc.config', JSON.stringify({drawerRefresh:true})); location.reload(); true")
    await new Promise(x => setTimeout(x, 2500))
    await waitShell()
    await new Promise(x => setTimeout(x, 800))
    console.log('B. 开启配置后存在刷新按钮:', await hasRefresh())
    const btnInfo = await evalJs("(()=>{var b=document.querySelector('.dsh-xc-refresh');if(!b)return null;var r=b.getBoundingClientRect();var cs=getComputedStyle(b);return {text:b.textContent.trim(),display:cs.display,visible:r.width>0&&r.height>0,where:b.parentElement?((b.parentElement.dataset.mobileNav||'')+'|'+b.parentElement.className.toString().slice(0,40)):'?'}})()")
    console.log('B. 刷新按钮信息:', JSON.stringify(btnInfo))

    await evalJs("document.querySelector('[data-mobile-nav=\"ham\"]')?.click()")
    await new Promise(x => setTimeout(x, 500))
    await evalJs("(()=>{var b=document.querySelector('[data-mobile-nav=\"drawer\"] .VOzbGW_trigger');if(b)b.click();return true})()")
    await new Promise(x => setTimeout(x, 900))
    await evalJs("(()=>{var b=[...document.querySelectorAll('[role=\"dialog\"] .VOzbGW_navCell')].find(function(x){return (x.textContent||'').includes('插件')});if(b)b.click();return true})()")
    await new Promise(x => setTimeout(x, 1000))
    const cardOpened = await evalJs("(()=>{var h=document.querySelector('[data-xc-card] .YyYd_a_header');if(!h)return false;h.click();return true})()")
    await new Promise(x => setTimeout(x, 400))
    const rows = await evalJs("(()=>{var card=document.querySelector('[data-xc-card]');return card?[...card.querySelectorAll('.dsh-xc-srow')].map(function(r){var lbl=r.querySelector('.dsh-xc-srow-title');return {label:lbl?lbl.textContent.trim():null,checked:!!r.querySelector('input[type=checkbox]')?.checked}}):[]})()")
    console.log('C. 配置卡行:', JSON.stringify(rows, null, 1))

    const toggled = await evalJs("(()=>{var row=document.querySelector('[data-xc-card] [data-xc-row=\"drawerRefresh\"] input[type=checkbox]');if(!row)return false;var cur=row.checked;row.click();return {was:cur}})()")
    console.log('D. 点击配置卡开关:', JSON.stringify(toggled))
    await new Promise(x => setTimeout(x, 1500))
    await evalJs("document.querySelector('[role=\"dialog\"] .VOzbGW_close')?.click()")
    await new Promise(x => setTimeout(x, 600))
    console.log('D. 关闭设置后（未刷新）抽屉刷新按钮存在:', await evalJs("!!document.querySelector('.dsh-xc-refresh')"))
    console.log('D. localStorage 现值:', await evalJs("localStorage.getItem('dsh-mobile-xc.config')"))
  } finally { try { ws?.close() } catch {}; child.kill() }
}
main().catch(e => { console.error('fail:', e.message); process.exit(1) })