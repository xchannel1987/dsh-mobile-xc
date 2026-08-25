#!/usr/bin/env node
/* 抓取刷新后的页面错误（v0.3.1 回归诊断） */
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
  const port = 8500 + Math.floor(Math.random() * 90)
  const ud = mkdtempSync(join(tmpdir(), 'dsh-xc-err-'))
  const child = spawn(browser, ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-first-run', '--remote-debugging-port=' + port, '--user-data-dir=' + ud, 'about:blank'], { stdio: 'ignore' })
  let ws = null
  const logs = []
  try {
    await waitPort(port, 15000)
    const pages = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json()
    ws = new WebSocket(pages.find(t => t.type === 'page').webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws')) })
    let id = 0
    const pend = new Map()
    ws.onmessage = ev => {
      const m = JSON.parse(ev.data)
      if (m.id !== undefined) { const f = pend.get(m.id); pend.delete(m.id); f && f(m); return }
      if (m.method === 'Runtime.consoleAPICalled') {
        const txt = (m.params.args || []).map(a => a.value ?? a.description ?? '').join(' ')
        logs.push('[console] ' + txt.slice(0, 300))
      }
      if (m.method === 'Runtime.exceptionThrown') {
        const d = m.params.exceptionDetails
        logs.push('[EXCEPTION] ' + ((d.exception && d.exception.description) || d.text || '').slice(0, 600))
      }
      if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
        logs.push('[log.error] ' + (m.params.entry.text || '').slice(0, 300))
      }
    }
    const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, m => m.error ? rej(new Error(method)) : res(m.result)); ws.send(JSON.stringify({ id: i, method, params })) })
    const evalJs = async e => { const r2 = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); return r2.result?.value }
    await send('Runtime.enable')
    await send('Page.enable')
    await send('Log.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
    await send('Page.navigate', { url: URL })
    await new Promise(x => setTimeout(x, 12000))
    const state = await evalJs("(()=>{var o=document.querySelector('[data-shell-overlay]');var root=document.getElementById('root');return {rootChildren:root?root.children.length:-1,shell:!!o,pluginFrame:o?o.parentElement.hasAttribute('data-mobile-nav'):false,bodyText:(document.body.innerText||'').slice(0,200)}})()")
    console.log('页面状态:', JSON.stringify(state, null, 1))
    console.log('===== 捕获的日志/异常（前 25 条）=====')
    for (const l of logs.slice(0, 25)) console.log(l)
    if (logs.length === 0) console.log('（无 console 输出）')
  } finally { try { ws?.close() } catch {}; child.kill() }
}
main().catch(e => { console.error('probe fail:', e.message); process.exit(1) })
