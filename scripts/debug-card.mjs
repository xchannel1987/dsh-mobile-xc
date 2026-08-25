#!/usr/bin/env node
/* 抓取 [xc-card] 诊断 + 打开设置确认卡 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
const URL = process.env.DSH_PROBE_URL ?? 'http://127.0.0.1:3080/'
function findBrowser(){const c=[process.env.DSH_PROBE_CHROME,'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe','C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe','C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe','C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'].filter(Boolean);for(const x of c)if(existsSync(x))return x;throw new Error('no browser')}
async function waitPort(port,ms){const t0=Date.now();for(;;){try{const r=await fetch('http://127.0.0.1:'+port+'/json/version');if(r.ok)return}catch{}if(Date.now()-t0>ms)throw new Error('timeout');await new Promise(x=>setTimeout(x,200))}}
async function main(){
  const browser=findBrowser();const port=8000+Math.floor(Math.random()*90);const ud=mkdtempSync(join(tmpdir(),'dsh-xc-dbg-'))
  const child=spawn(browser,['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-first-run','--remote-debugging-port='+port,'--user-data-dir='+ud,'about:blank'],{stdio:'ignore'})
  let ws=null;const logs=[]
  try{
    await waitPort(port,15000)
    const pages=await (await fetch('http://127.0.0.1:'+port+'/json/list')).json()
    ws=new WebSocket(pages.find(t=>t.type==='page').webSocketDebuggerUrl)
    await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=()=>rej(new Error('ws'))})
    let id=0;const pend=new Map()
    ws.onmessage=ev=>{const m=JSON.parse(ev.data);if(m.id!==undefined){const f=pend.get(m.id);pend.delete(m.id);f&&f(m);return}
      if(m.method==='Runtime.consoleAPICalled'){const t=(m.params.args||[]).map(a=>a.value??a.description??'').join(' ');logs.push(t.slice(0,200))}
      if(m.method==='Runtime.exceptionThrown'){const d=m.params.exceptionDetails;logs.push('EXC: '+((d.exception&&d.exception.description)||d.text||'').slice(0,300))}}
    const send=(method,params={})=>new Promise((res,rej)=>{const i=++id;pend.set(i,m=>m.error?rej(new Error(method)):res(m.result));ws.send(JSON.stringify({id:i,method,params}))})
    const evalJs=async e=>{const r2=await send('Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:true});if(r2.exceptionDetails)return '__EXC__';return r2.result?.value}
    await send('Runtime.enable');await send('Page.enable')
    await send('Emulation.setDeviceMetricsOverride',{width:1024,height:900,deviceScaleFactor:1,mobile:false})
    await send('Page.navigate',{url:URL})
    for(let i=0;i<90;i++){if(await evalJs("!!document.querySelector('[data-shell-overlay]')"))break;await new Promise(x=>setTimeout(x,500))}
    await new Promise(x=>setTimeout(x,6000))
    console.log('[xc-card] 日志:', logs.filter(l=>l.includes('[xc-card]')))
    // bundle rev vs 磁盘
    const rev = await evalJs("(()=>{var n=performance.getEntriesByType('resource').map(function(e){return e.name}).find(function(n){return n.includes('dsh-mobile-xc')&&n.includes('client.js')});return n||null})()")
    const sha = createHash('sha1').update(readFileSync(join(process.cwd(),'lib/client.js'),'utf8')).digest('hex').slice(0,12)
    console.log('bundle rev:', rev, '| 磁盘 sha:', sha, '| 匹配:', rev ? rev.includes(sha) : 'n/a')
    // 打开设置 -> 插件 -> 查卡
    await evalJs("(()=>{var b=[...document.querySelectorAll('button')].find(function(x){return (x.textContent||'').trim()==='\u8bbe\u7f6e'});if(b)b.click();return !!b})()")
    await new Promise(x=>setTimeout(x,1200))
    await evalJs("(()=>{var b=[...document.querySelectorAll('[aria-modal] button')].find(function(x){return (x.textContent||'').trim()==='\u63d2\u4ef6'});if(b)b.click();return !!b})()")
    await new Promise(x=>setTimeout(x,1200))
    const card = await evalJs("(()=>{var all=[...document.querySelectorAll('[aria-modal] *')];var c=[...all].find(function(el){return el.children.length>0&&(el.textContent||'').includes('dsh-mobile-xc')&&(el.textContent||'').includes('\u8ddf\u624b')});if(!c)return null;return {text:c.textContent.trim().slice(0,100),boxes:c.querySelectorAll('input[type=checkbox]').length}})()")
    console.log('配置卡:', JSON.stringify(card))
  } finally { try{ws?.close()}catch{};child.kill() }
}
main().catch(e=>{console.error('fail:',e.message);process.exit(1)})
