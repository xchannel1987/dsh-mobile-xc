#!/usr/bin/env node
/* dev 取证：真实 tap 会话叶子 -> 断言 click 是否命中、活动会话是否切换、bundle rev 是否最新 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

const URL = process.env.DSH_PROBE_URL ?? 'http://127.0.0.1:3080/'
function findBrowser() {
  const cands = [process.env.DSH_PROBE_CHROME,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'].filter(Boolean)
  for (const c of cands) if (existsSync(c)) return c
  throw new Error('no browser')
}
async function waitPort(port, ms) {
  const t0 = Date.now()
  for (;;) {
    try { const res = await fetch('http://127.0.0.1:' + port + '/json/version'); if (res.ok) return } catch {}
    if (Date.now() - t0 > ms) throw new Error('timeout')
    await new Promise(r => setTimeout(r, 200))
  }
}
async function main() {
  const browser = findBrowser()
  const port = 9700 + Math.floor(Math.random() * 90)
  const userData = mkdtempSync(join(tmpdir(), 'dsh-xc-sess-'))
  const child = spawn(browser, ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-first-run', '--remote-debugging-port=' + port, '--user-data-dir=' + userData, 'about:blank'], { stdio: 'ignore' })
  let ws = null
  try {
    await waitPort(port, 15000)
    const pages = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json()
    ws = new WebSocket(pages.find(t => t.type === 'page').webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws')) })
    let id = 0
    const pending = new Map()
    const consoleLogs = []
    ws.onmessage = ev => {
      const msg = JSON.parse(ev.data)
      if (msg.id !== undefined) { const f = pending.get(msg.id); pending.delete(msg.id); f && f(msg); return }
      if (msg.method === 'Runtime.consoleAPICalled') {
        const txt = (msg.params.args || []).map(a => a.value ?? a.description ?? '').join(' ')
        consoleLogs.push(txt)
      }
    }
    const send = (method, params = {}) => new Promise((res, rej) => {
      const i = ++id
      pending.set(i, m => m.error ? rej(new Error(method)) : res(m.result))
      ws.send(JSON.stringify({ id: i, method, params }))
    })
    const evalJs = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.value
    await send('Runtime.enable')
    await send('Page.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })

    // 注入点击事件记录器（捕获+冒泡两层）
    await send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.__tapLog=[];document.addEventListener("pointerdown",e=>__tapLog.push("pd:"+e.target.tagName),true);document.addEventListener("pointerup",e=>__tapLog.push("pu:"+e.target.tagName),true);document.addEventListener("mousedown",e=>__tapLog.push("md:"+e.target.tagName),true);document.addEventListener("mouseup",e=>__tapLog.push("mu:"+e.target.tagName),true);document.addEventListener("click",e=>__tapLog.push("cl:"+e.target.tagName+":"+(e.target.className||"").toString().slice(0,40)),true);' })
    await send('Page.navigate', { url: URL })
    for (let i = 0; i < 60; i++) {
      if (await evalJs("!!document.querySelector('[data-shell-overlay]')&&!!document.querySelector('[data-shell-overlay]').parentElement.hasAttribute('data-mobile-nav')")) break
      await new Promise(r => setTimeout(r, 500))
    }

    // 当前 bundle rev
    const rev = await evalJs("(()=>{const ent=performance.getEntriesByType('resource').map(e=>e.name).find(n=>n.includes('dsh-mobile-xc')&&n.includes('client.js'));return ent||null})()")
    const sha = createHash('sha1').update(readFileSync(join(process.cwd(), 'lib/client.js'), 'utf8')).digest('hex').slice(0, 12)
    console.log('bundle url:', rev)
    console.log('磁盘 lib/client.js sha1(12):', sha, '| rev 含该哈希:', rev ? rev.includes(sha) : 'n/a')

    await evalJs("document.querySelector('[data-mobile-nav=\"ham\"]')?.click()")
    await new Promise(r => setTimeout(r, 600))
    console.log('drawer open:', await evalJs("!document.querySelector('[data-shell-overlay]').parentElement.hasAttribute('data-sidebar-collapsed')"))

    // 定位一个叶子会话行（无 aria-expanded、非"新会话"）
    const row = await evalJs("(()=>{const rs=[...document.querySelectorAll('[data-mobile-nav=\"drawer\"] [role=\"treeitem\"]')];const el=rs.find(r=>!r.hasAttribute('aria-expanded')&&r.textContent.trim()!=='新会话');if(!el)return null;const b=el.getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2,text:el.textContent.trim().slice(0,24),tag:el.tagName}})()")
    console.log('target session row:', JSON.stringify(row))
    if (!row) { console.log('no leaf session found'); return }

    // 活动态标记：会话头 crumb 文本 + 行内选中态
    const before = await evalJs("(()=>{const c=document.querySelector('[class*=\"_crumbs\"]')?.textContent||'';const sel=document.querySelector('[data-mobile-nav=\"drawer\"] [aria-selected=\"true\"], [data-mobile-nav=\"drawer\"] [class*=\"active\" i]')?.textContent?.trim().slice(0,20)||'';return {crumb:c.trim().slice(0,30),activeRow:sel}})()")
    console.log('before tap:', JSON.stringify(before))

    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: row.x, y: row.y, button: 'left', clickCount: 1, pointerType: 'touch' })
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: row.x, y: row.y, button: 'left', clickCount: 1, pointerType: 'touch' })
    await new Promise(r => setTimeout(r, 650))

    const after = await evalJs("(()=>{const c=document.querySelector('[class*=\"_crumbs\"]')?.textContent||'';const sel=document.querySelector('[data-mobile-nav=\"drawer\"] [aria-selected=\"true\"], [data-mobile-nav=\"drawer\"] [class*=\"active\" i]')?.textContent?.trim().slice(0,20)||'';return {crumb:c.trim().slice(0,30),activeRow:sel,drawerOpen:!document.querySelector('[data-shell-overlay]').parentElement.hasAttribute('data-sidebar-collapsed')}})()")
    console.log('after tap :', JSON.stringify(after))
    console.log('tap events:', JSON.stringify(await evalJs('window.__tapLog')))
  } finally {
    try { ws?.close() } catch {}
    child.kill()
  }
}
main().catch(e => { console.error('session probe failed:', e.message); process.exit(1) })
