#!/usr/bin/env node
/* 验证：移动端关闭按钮移入 nav 后仍可点击关闭；切 section 正常；桌面(>=1024px)零影响 */
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
  const port = 8600 + Math.floor(Math.random() * 90)
  const ud = mkdtempSync(join(tmpdir(), 'dsh-xc-close-'))
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
    await send('Page.navigate', { url: URL })
    for (let i = 0; i < 90; i++) {
      if (await evalJs("!!document.querySelector('[data-shell-overlay]')")) break
      await new Promise(x => setTimeout(x, 500))
    }
    const openSettings = async () => {
      await evalJs("document.querySelector('[data-mobile-nav=\"ham\"]')?.click()")
      await new Promise(x => setTimeout(x, 500))
      return evalJs("(()=>{var b=document.querySelector('[data-mobile-nav=\"drawer\"] .VOzbGW_trigger');if(!b)return false;b.click();return true})()")
    }
    // ---- 移动端 390 ----
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
    await new Promise(x => setTimeout(x, 600))
    await openSettings()
    await new Promise(x => setTimeout(x, 800))
    const closeClick = await evalJs(`(()=>{
      var close = document.querySelector('[role="dialog"] .VOzbGW_close')
      if(!close) return 'NO CLOSE BTN'
      var inNav = close.parentElement && close.parentElement.tagName === 'NAV'
      close.click()
      return 'clicked, wasInNav=' + inNav
    })()`)
    console.log('移动端关闭按钮:', closeClick)
    await new Promise(x => setTimeout(x, 500))
    const closed = await evalJs("document.querySelector('[role=\"dialog\"][aria-modal=\"true\"]') === null")
    console.log('对话框已关闭:', closed)
    // ---- 移动端：重新打开 + 切 section（插件页） ----
    await openSettings()
    await new Promise(x => setTimeout(x, 800))
    const movedAgain = await evalJs(`(()=>{var c=document.querySelector('[role="dialog"] .VOzbGW_close');return !!c && c.parentElement.tagName==='NAV'})()`)
    console.log('重开后关闭按钮仍在 nav:', movedAgain)
    const switchSection = await evalJs(`(()=>{var b=[...document.querySelectorAll('[role="dialog"] .VOzbGW_navCell')].find(function(x){return (x.textContent||'').includes('插件')});if(!b)return false;b.click();return true})()`)
    console.log('切到插件页:', switchSection)
    await new Promise(x => setTimeout(x, 900))
    const pluginVisible = await evalJs("document.body.innerText.includes('插件市场') || !!document.querySelector('[role=\"dialog\"]')?.textContent.includes('可配置')")
    const closeAfterSwitch = await evalJs(`(()=>{var c=document.querySelector('[role="dialog"] .VOzbGW_close');if(!c)return 'NO';c.click();return c.parentElement.tagName==='NAV'?'in-nav':'not-nav'})()`)
    await new Promise(x => setTimeout(x, 400))
    const closed2 = await evalJs("document.querySelector('[role=\"dialog\"][aria-modal=\"true\"]') === null")
    console.log('插件页渲染:', pluginVisible, '| 插件页下关闭按钮:', closeAfterSwitch, '| 再次关闭成功:', closed2)
    // ---- 桌面 1280：零影响 ----
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false })
    await new Promise(x => setTimeout(x, 700))
    await evalJs("(()=>{var b=[...document.querySelectorAll('button')].find(function(x){return (x.textContent||'').trim()==='设置'});if(b)b.click();return true})()")
    await new Promise(x => setTimeout(x, 900))
    const desktop = await evalJs(`(()=>{
      var dlg = document.querySelector('[role="dialog"][aria-modal="true"]')
      if(!dlg) return null
      var c = dlg.querySelector('.VOzbGW_close')
      var t = dlg.querySelector('.VOzbGW_navTitle')
      var docBtn = [...dlg.querySelectorAll('button')].find(b=>(b.textContent||'').trim()==='打开配置文件')
      return {
        closeInNav: !!c && c.parentElement && c.parentElement.tagName==='NAV',
        titleWrap: t ? getComputedStyle(t).whiteSpace : null,
        docBtnVisible: docBtn ? getComputedStyle(docBtn).display !== 'none' : 'no-btn',
        headerVisible: (()=>{var h=dlg.querySelector('.VOzbGW_header');return h? getComputedStyle(h).display !== 'none' : null})()
      }
    })()`)
    console.log('桌面 1280 状态:', JSON.stringify(desktop))
  } finally { try { ws?.close() } catch {}; child.kill() }
}
main().catch(e => { console.error('fail:', e.message); process.exit(1) })
