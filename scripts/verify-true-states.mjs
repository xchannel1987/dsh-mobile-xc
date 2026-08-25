#!/usr/bin/env node
/* 端到端：读取卡各行勾选态（期望 dragEnabled=true -> on） */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const URL = process.env.DSH_PROBE_URL ?? 'http://127.0.0.1:3080/'
function findBrowser(){const c=[process.env.DSH_PROBE_CHROME,'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe','C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe','C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe','C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'].filter(Boolean);for(const x of c)if(existsSync(x))return x;throw new Error('no browser')}
async function waitPort(port,ms){const t0=Date.now();for(;;){try{const r=await fetch('http://127.0.0.1:'+port+'/json/version');if(r.ok)return}catch{}if(Date.now()-t0>ms)throw new Error('timeout');await new Promise(x=>setTimeout(x,200))}}
async function main(){
  const browser=findBrowser();const port=7200+Math.floor(Math.random()*90);const ud=mkdtempSync(join(tmpdir(),'dsh-xc-true-'))
  const child=spawn(browser,['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-first-run','--remote-debugging-port='+port,'--user-data-dir='+ud,'about:blank'],{stdio:'ignore'})
  let ws=null
  try{
    await waitPort(port,15000)
    const pages=await (await fetch('http://127.0.0.1:'+port+'/json/list')).json()
    ws=new WebSocket(pages.find(t=>t.type==='page').webSocketDebuggerUrl)
    await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=()=>rej(new Error('ws'))})
    let id=0;const pend=new Map()
    ws.onmessage=ev=>{const m=JSON.parse(ev.data);if(m.id!==undefined){const f=pend.get(m.id);pend.delete(m.id);f&&f(m)}}
    const send=(method,params={})=>new Promise((res,rej)=>{const i=++id;pend.set(i,m=>m.error?rej(new Error(method)):res(m.result));ws.send(JSON.stringify({id:i,method,params}))})
    const evalJs=async e=>{const r2=await send('Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:true});if(r2.exceptionDetails)return '__EXC__';return r2.result?.value}
    await send('Runtime.enable');await send('Page.enable')
    await send('Emulation.setDeviceMetricsOverride',{width:1024,height:900,deviceScaleFactor:1,mobile:false})
    await send('Page.navigate',{url:URL})
    for(let i=0;i<90;i++){if(await evalJs("!!document.querySelector('[data-shell-overlay]')"))break;await new Promise(x=>setTimeout(x,500))}
    await new Promise(x=>setTimeout(x,2500))
    await evalJs("(()=>{var b=[...document.querySelectorAll('button')].find(function(x){return (x.textContent||'').trim()==='\u8bbe\u7f6e'});if(b)b.click();return !!b})()")
    await new Promise(x=>setTimeout(x,1200))
    await evalJs("(()=>{var b=[...document.querySelectorAll('[aria-modal] button')].find(function(x){return (x.textContent||'').trim()==='\u63d2\u4ef6'});if(b)b.click();return !!b})()")
    await new Promise(x=>setTimeout(x,1200))
    const st = await evalJs("(()=>{var c=document.querySelector('[data-xc-card]');if(!c)return 'no-card';c.querySelector('.YyYd_a_header').click();return true})()")
    await new Promise(x=>setTimeout(x,600))
    const rows = await evalJs("(()=>{var c=document.querySelector('[data-xc-card]');if(!c)return null;return [...c.querySelectorAll('[data-xc-row]')].map(function(r){return {title:r.querySelector('.dsh-xc-srow-title').textContent,checked:r.querySelector('input').checked,on:r.querySelector('.dsh-xc-switch').className.includes('on')}})})()")
    console.log('卡打开:', st)
    console.log('各行状态:', JSON.stringify(rows, null, 1))
    if (rows) {
      const ok = rows[0] && rows[0].checked === true && rows[0].on
      console.log('结果:', ok ? 'PASS：配置文件 true 的开关显示为开' : 'FAIL：仍未显示开')
    }
  } finally { try{ws?.close()}catch{};child.kill() }
}
main().catch(e=>{console.error('fail:',e.message);process.exit(1)})
