#!/usr/bin/env node
/* 验证：tab 列表横向滚动时，关闭按钮与"设置"标题保持固定 */
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
  const ud = mkdtempSync(join(tmpdir(), 'dsh-xc-scrl-'))
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
    for (let i = 0; i < 90; i++) {
      if (await evalJs("!!document.querySelector('[data-shell-overlay]')")) break
      await new Promise(x => setTimeout(x, 500))
    }
    await evalJs("document.querySelector('[data-mobile-nav=\"ham\"]')?.click()")
    await new Promise(x => setTimeout(x, 500))
    await evalJs("(()=>{var b=document.querySelector('[data-mobile-nav=\"drawer\"] .VOzbGW_trigger');if(b)b.click();return true})()")
    await new Promise(x => setTimeout(x, 800))

    const snap = async () => evalJs(`(()=>{
      var dlg = document.querySelector('[role="dialog"][aria-modal="true"]')
      if(!dlg) return null
      var close = dlg.querySelector('.VOzbGW_close')
      var title = dlg.querySelector('.VOzbGW_navTitle')
      var list = dlg.querySelector('.VOzbGW_navList')
      var cell = list ? list.querySelector('.VOzbGW_navCell') : null
      function X(el){return el ? Math.round(el.getBoundingClientRect().x) : null}
      return {
        closeX: X(close), titleX: X(title),
        firstCellX: X(cell),
        navScrollW: dlg.querySelector(':scope > nav').scrollWidth,
        navClientW: dlg.querySelector(':scope > nav').clientWidth,
        listScrollW: list ? list.scrollWidth : null,
        listClientW: list ? list.clientWidth : null,
        listScrollLeft: list ? list.scrollLeft : null
      }
    })()`)
    const before = await snap()
    console.log('滚动前:', JSON.stringify(before))
    // 模拟滑动 tab：把 navList 滚到末尾
    await evalJs(`(()=>{var l=document.querySelector('[role="dialog"] .VOzbGW_navList');if(l)l.scrollLeft = 500;return true})()`)
    await new Promise(x => setTimeout(x, 300))
    const after = await snap()
    console.log('滚动后:', JSON.stringify(after))
    const closeFixed = before.closeX === after.closeX && after.closeX === 12
    const titleFixed = before.titleX === after.titleX
    const listScrolled = after.listScrollLeft > 0
    const cellMoved = before.firstCellX !== after.firstCellX && (after.firstCellX ?? 999) < (before.firstCellX ?? -1)
    console.log('关闭按钮固定:', closeFixed, '| 标题固定:', titleFixed, '| tab 列表已滚动:', listScrolled, '| 首个 tab 移出视口:', cellMoved)
  } finally { try { ws?.close() } catch {}; child.kill() }
}
main().catch(e => { console.error('fail:', e.message); process.exit(1) })
