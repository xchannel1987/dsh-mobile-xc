#!/usr/bin/env node
/* 诊断移动端设置页头：dump 设置对话框结构 + 页头“设置”是否换行 + 关闭按钮/打开配置文件按钮位置 */
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
  const ud = mkdtempSync(join(tmpdir(), 'dsh-xc-hdr-'))
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
    await new Promise(x => setTimeout(x, 600))
    const opened = await evalJs("(()=>{var b=document.querySelector('[data-mobile-nav=\"drawer\"] .VOzbGW_trigger');if(!b)return false;b.click();return true})()")
    console.log('设置已点开:', opened)
    await new Promise(x => setTimeout(x, 900))
    const summary = await evalJs(`(()=>{
      var dlg = document.querySelector('[role="dialog"][aria-modal="true"]')
      if(!dlg) return { found:false }
      function walk(el, depth, out){
        if(depth>6 || out.length>70) return
        var cls = (el.className && el.className.toString) ? el.className.toString() : ''
        var txt = (el.childElementCount===0 ? (el.textContent||'').trim() : '').slice(0,14)
        var isText = el.children.length===0 && txt
        if(isText || /VOzbGW_|me01iq_/.test(cls)){
          out.push({ tag: el.tagName, cls: cls.slice(0,60), txt, depth })
        }
        for(const c of el.children) walk(c, depth+1, out)
      }
      var out=[]
      for(const c of dlg.children) walk(c, 1, out)
      return { found:true, children: out }
    })()`)
    console.log('对话框结构:')
    console.log(JSON.stringify(summary, null, 1))
    const wrap = await evalJs(`(()=>{
      var t = document.querySelector('[role="dialog"][aria-modal="true"] .VOzbGW_navTitle')
      if(!t) return null
      var cs = getComputedStyle(t)
      var box = t.getBoundingClientRect()
      var lineH = parseFloat(cs.lineHeight) || 0
      return {
        text: t.textContent.trim(),
        rectH: box.height,
        lineHeight: cs.lineHeight,
        computedLines: lineH>0 ? Math.round(box.height/lineH) : null,
        whiteSpace: cs.whiteSpace,
        fontSize: cs.fontSize,
        parentFlexDir: getComputedStyle(t.parentElement).flexDirection,
        parentWidth: t.parentElement.getBoundingClientRect().width
      }
    })()`)
    console.log('页头设置换行诊断:', JSON.stringify(wrap, null, 1))
    const headerInfo = await evalJs(`(()=>{
      var dlg = document.querySelector('[role="dialog"][aria-modal="true"]')
      if(!dlg) return null
      var out = {}
      var hdr = dlg.querySelector('.VOzbGW_header')
      if(hdr){
        out.headerRect = (()=>{var r=hdr.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}})()
        out.headerChildren = [...hdr.children].map(c=>({tag:c.tagName,cls:(c.className||'').toString().slice(0,50),txt:(c.textContent||'').trim().slice(0,16)}))
      }
      var act = dlg.querySelector('.VOzbGW_actions')
      if(act){
        out.actionsChildren = [...act.children].map(c=>({tag:c.tagName,cls:(c.className||'').toString().slice(0,50),txt:(c.textContent||'').trim().slice(0,16)}))
        out.actionsRect = (()=>{var r=act.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}})()
      }
      var close = dlg.querySelector('.VOzbGW_close')
      if(close){
        out.closeRect = (()=>{var r=close.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}})()
        out.closeBtnTxt = (close.textContent||'').trim()
      }
      var docBtn = [...dlg.querySelectorAll('button')].find(b=>(b.textContent||'').includes('打开配置文件'))
      if(docBtn){
        out.docBtnRect = (()=>{var r=docBtn.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}})()
        out.docBtnOuter = docBtn.outerHTML.slice(0,300)
      } else out.docBtn = 'NOT FOUND'
      return out
    })()`)
    // ==== 修复断言 ====
    const verify = await evalJs(`(()=>{
      var dlg = document.querySelector('[role="dialog"][aria-modal="true"]')
      if(!dlg) return null
      var out = { width: innerWidth }
      // 1) 页头“设置”不换行
      var title = dlg.querySelector('.VOzbGW_navTitle')
      if(title){
        var cs = getComputedStyle(title)
        var box = title.getBoundingClientRect()
        out.title = {
          text: title.textContent.trim(),
          rectH: Math.round(box.height),
          lineHeight: cs.lineHeight,
          whiteSpace: cs.whiteSpace,
          flex: cs.flex,
          flexGrow: cs.flexGrow, flexShrink: cs.flexShrink,
          width: Math.round(box.width)
        }
      }
      // 2) 打开配置文件按钮不可见
      var docBtn = [...dlg.querySelectorAll('button')].find(b=>(b.textContent||'').trim()==='打开配置文件' || (b.textContent||'').trim()==='Open configuration file')
      if(docBtn){
        var csb = getComputedStyle(docBtn)
        out.openDocBtn = { display: csb.display, visibility: csb.visibility, rectW: Math.round(docBtn.getBoundingClientRect().width) }
      } else out.openDocBtn = 'NOT FOUND'
      // 3) 关闭按钮在标题左侧同行
      var close = dlg.querySelector('.VOzbGW_close')
      var nav = dlg.querySelector(':scope > nav')
      if(close && title && nav){
        var cb = close.getBoundingClientRect(), tb = title.getBoundingClientRect()
        out.closeBtn = {
          parentIsNav: close.parentElement === nav,
          x: Math.round(cb.x), y: Math.round(cb.y), w: Math.round(cb.width), h: Math.round(cb.height),
          titleX: Math.round(tb.x),
          leftOfTitle: cb.x < tb.x,
          sameRow: Math.abs(cb.y - tb.y) < 12
        }
      }
      // 4) header 行收起
      var hdr = dlg.querySelector('.VOzbGW_header')
      if(hdr) out.header = { display: getComputedStyle(hdr).display }
      var actions = dlg.querySelector('.VOzbGW_actions')
      if(actions) out.actions = { display: getComputedStyle(actions).display }
      return out
    })()`)
    console.log('========== 修复断言 ==========')
    console.log(JSON.stringify(verify, null, 1))


  } finally { try { ws?.close() } catch {}; child.kill() }
}
main().catch(e => { console.error('fail:', e.message); process.exit(1) })