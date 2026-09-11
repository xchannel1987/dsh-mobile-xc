#!/usr/bin/env node
/* 门禁探针（开发调试用，不进生产构建）：M6 页头横向滑动不变式，无头 CDP 真页面读数。
 *
 * 用法：
 *   node scripts/probe-header-swipe.mjs
 * 目标 URL 解析顺序（三取一）：
 *   1. DSH_PROBE_URL          —— 直接给整条 URL（rc.2 起 GET / 要签名 cookie，通常需含 ?token=）
 *   2. DSH_PROBE_TOKEN_FILE   —— 指向一个文本文件，文件内容是一整条含 ?token= 的 URL
 *   3. 兜底：读 ~/.dsh/dsh-web.log 最后一条含 ?token= 的行
 *      注意：launch token 只在进程内 Map、经 dsh-power-xc 电源按钮重启的实例 stdout 不落盘，
 *      日志兜底仅对「从终端直接启动、且当前进程自己写过该日志」的实例有效；否则请走 1 或 2。
 * 其他环境变量：DSH_PROBE_CHROME（浏览器路径）/ DSH_PROBE_TIMEOUT_MS（DOM 等待上限，默认 20000）
 *
 * 断言 28 条（当前计数；以 2026-09-11 真浏览器跑绿的参考实现为准，一条不多一条不少）：
 *   390x844 进会话 + 门栓/滚动容器/crumbs 地板/actions 基准与不换行/两臂规则（CSSOM 存活
 *   + display:contents + 徽标根 flex-shrink）/单行高度/无常驻弹层 + 人造溢出（more 属性、
 *   mask 渐隐、滑到最右撤除、滚回左边复现、撤桩回基线，溢出态可逆）+ 375/380px 仍单行
 *   （反制 dsh-token-usage-xc ≤380px 换行）+ 开关关 4 条 + 桌面 1440x900 零影响 5 条。
 * 输出：每条 PASS/FAIL 一行（均带读数明细），末行「通过数/总数」；任一 FAIL 退出码 1。
 * 安全：token 一个字都不打印、不落仓库文件；所有可能带 URL 的异常信息一律先过 redact() 掩码。
 *
 * 页面侧代码一律写成真实函数 + .toString() 序列化（call(fn, ...args)，参数走 JSON.stringify）：
 * 字符串套字符串的转义层容易在工具侧翻车，且序列化丢闭包——页内函数不得引用模块级常量，
 * 选择器一律作参数传入；属性值不带引号的合法形态（[role=treeitem]、[data-mobile-nav=frame]）
 * 从写法上根除内层引号。 */
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir, homedir } from 'node:os'
import { join } from 'node:path'

const TIMEOUT_MS = Number(process.env.DSH_PROBE_TIMEOUT_MS ?? 20000)
// 属性值不带引号（与 [data-mobile-nav="frame"] 完全等价的合法 CSS 形态），免除内层转义
const CLUSTER = '[data-mobile-nav=frame] .wSkVaW_titleRow .wSkVaW_titleCluster'
const CLUSTER_DESKTOP = '.wSkVaW_titleCluster' // 桌面档没有 frame 锚（那是移动断点才挂的），只能用裸类
const CONFIG_KEY = 'dsh-mobile-xc.config'
const CONFIG_OFF = { swipeEnabled: true, dshmarketNavFix: true, pwaEnabled: true, drawerRefresh: false, headerScroll: false }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
// 任何可能回显 URL 的字符串出口都先过这里：只保留掩码前缀
const redact = (s) => String(s).replace(/([?&]token=)[^&\s"';)]*/g, '$1***')

function findBrowser() {
  const c = [process.env.DSH_PROBE_CHROME,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'].filter(Boolean)
  for (const x of c) if (existsSync(x)) return x
  console.error('[probe-header-swipe] 未找到 Chromium 系浏览器，设置 DSH_PROBE_CHROME')
  process.exit(2)
}

/** 解析目标 URL：DSH_PROBE_URL > DSH_PROBE_TOKEN_FILE > ~/.dsh/dsh-web.log 最后一条 token 行。 */
function probeUrl() {
  const direct = process.env.DSH_PROBE_URL
  if (direct) return direct
  const tf = process.env.DSH_PROBE_TOKEN_FILE
  if (tf && existsSync(tf)) return readFileSync(tf, 'utf8').trim()
  let log = ''
  try { log = readFileSync(join(homedir(), '.dsh', 'dsh-web.log'), 'utf8') } catch { /* 日志不存在 */ }
  const line = log.split('\n').filter((s) => s.indexOf('?token=') >= 0).pop()
  if (!line) throw new Error('拿不到可用 URL：设 DSH_PROBE_URL，或 DSH_PROBE_TOKEN_FILE 指向含完整 URL 的文件；日志兜底仅对终端直接启动的实例有效')
  return line.slice(line.indexOf('http')).split(' ')[0]
}

// —— 页内函数（经 call 序列化执行，不得引用任何模块作用域变量）——
function pgOverlay() { return document.querySelector('[data-shell-overlay]') !== null }
function pgDismiss() { const b = [...document.querySelectorAll('button')].find(x => (x.innerText || '').trim() === '稍后配置'); if (!b) return null; const r = b.getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) } }
function pgHam() { const h = document.querySelector('[data-mobile-nav=ham]'); if (!h) return null; const b = h.getBoundingClientRect(); return { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) } }
function pgTree() { const out = []; for (const r of (document.querySelector('[data-mobile-nav=drawer]') || document).querySelectorAll('[role=treeitem]')) { const b = r.getBoundingClientRect(); out.push({ t: (r.textContent || '').trim().slice(0, 26), exp: r.getAttribute('aria-expanded'), w: Math.round(b.width) }) } return out }
function pgClick(i) { const rs = [...(document.querySelector('[data-mobile-nav=drawer]') || document).querySelectorAll('[role=treeitem]')]; const el = rs[i]; if (!el) return null; el.scrollIntoView({ block: 'center' }); const b = el.getBoundingClientRect(); return { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) } }
function pgHas(sel) { return document.querySelector(sel) !== null }
function pgSetConfig(key, value) { localStorage.setItem(key, JSON.stringify(value)); return true }
function pgDelConfig(key) { localStorage.removeItem(key); return true }
function pgSpacerOn(clusterSel) { const c = document.querySelector(clusterSel); const w = document.createElement('div'); w.id = 'xc-spacer'; w.style.cssText = 'flex:0 0 52px;height:20px'; c.appendChild(w); return true }
function pgSpacerOff() { const w = document.getElementById('xc-spacer'); if (w) w.remove(); return true }
function pgScroll(clusterSel, v) { const c = document.querySelector(clusterSel); c.scrollLeft = v; return true }
function pgGeo(clusterSel) {
  const c = document.querySelector(clusterSel)
  if (!c) return { err: 'no cluster' }
  const crumbs = c.querySelector('nav')
  const actions = c.querySelector('[class*=_headerActions]')
  const anchor = actions ? actions.firstElementChild : null
  const badge = anchor ? anchor.firstElementChild : null
  const g = (el) => (el ? getComputedStyle(el) : null)
  const row = c.closest('.wSkVaW_titleRow')
  return {
    htmlAttr: document.documentElement.hasAttribute('data-xc-hscroll'),
    overflowX: g(c).overflowX, clusterWrap: g(c).flexWrap,
    crumbsMinWidth: crumbs ? g(crumbs).minWidth : null,
    actionsBasis: actions ? g(actions).flexBasis : null, actionsWrap: actions ? g(actions).flexWrap : null,
    anchorDisplay: anchor ? g(anchor).display : null,
    badgeShrink: badge ? g(badge).flexShrink : null,
    rowHeight: row ? Math.round(row.getBoundingClientRect().height) : null,
    popupNodes: c.querySelectorAll('ul[aria-label],[role=menu],[role=dialog]').length,
    cw: c.clientWidth, sw: c.scrollWidth,
    more: c.hasAttribute('data-xc-hscroll-more'), mask: g(c).maskImage,
  }
}
function pgCssomTwoArms() {
  const hit = (rs) => {
    for (const r of rs) {
      if (r.selectorText && r.selectorText.indexOf('.wSkVaW_headerActions > *') >= 0 && r.selectorText.indexOf('[data-slot=') >= 0) return r.selectorText
      if (r.cssRules) { const s = hit(r.cssRules); if (s) return s } // 下钻进 @media 的内层 cssRules
    }
    return null
  }
  for (const sh of document.styleSheets) {
    let rs = null
    try { rs = sh.cssRules } catch (e) { continue }
    const s = hit(rs)
    if (s) return { t: s, arms: s.split(',').length }
  }
  return null
}
function pgDesktopGate(clusterSel) {
  const c = document.querySelector(clusterSel)
  const g = (el) => (el ? getComputedStyle(el) : null)
  const nav = c ? c.querySelector('nav') : null
  return { gate: document.documentElement.hasAttribute('data-xc-hscroll'), found: !!c, overflowX: c ? g(c).overflowX : null, mask: c ? g(c).maskImage : null, crumbsMin: nav ? g(nav).minWidth : null }
}

async function main() {
  const browser = findBrowser()
  const port = 9000 + Math.floor(Math.random() * 900)
  const child = spawn(browser, ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu',
    '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=' + port,
    '--user-data-dir=' + mkdtempSync(join(tmpdir(), 'xc-hscroll-')), 'about:blank'], { stdio: 'ignore' })
  let ws = null
  const results = []
  const check = (label, ok, detail) => { results.push(!ok); console.log((ok ? 'PASS  ' : 'FAIL  ') + label + (detail === undefined ? '' : '  [' + JSON.stringify(detail) + ']')) }
  try {
    for (let i = 0; i < 75; i++) { try { if ((await fetch('http://127.0.0.1:' + port + '/json/version')).ok) break } catch {} await sleep(200) }
    const pages = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json()
    ws = new WebSocket(pages.find(t => t.type === 'page').webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws')) })
    let id = 0
    const pending = new Map()
    ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id !== undefined) { const p = pending.get(m.id); if (p) { pending.delete(m.id); p(m) } } }
    const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, m => m.error ? rej(new Error(redact(method + ':' + JSON.stringify(m.error).slice(0, 200)))) : res(m.result)); ws.send(JSON.stringify({ id: i, method, params })) })
    const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(redact((r.exceptionDetails.exception?.description || r.exceptionDetails.text || '').slice(0, 300))); return r.result?.value }
    const waitDom = async (expr, ms = TIMEOUT_MS) => { const s = Date.now(); for (;;) { if (await ev(expr)) return true; if (Date.now() - s > ms) return false; await sleep(250) } }
    const tap = async (x, y) => { await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] }); await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }) }
    await send('Runtime.enable'); await send('Page.enable')

    const callExpr = (fn, ...args) => '(' + fn.toString() + ')(' + args.map((a) => JSON.stringify(a)).join(',') + ')'
    const call = (fn, ...args) => ev(callExpr(fn, ...args))
    const waitFn = (fn, ms) => waitDom(callExpr(fn), ms)
    const geo = () => call(pgGeo, CLUSTER)

    // —— 进会话配方（2026-09-11 真浏览器实测）——
    // 1) 首次启动的 onboarding 模态比 [data-shell-overlay] 晚到 2~4 秒且吃掉所有点击，先点「稍后配置」；
    // 2) 开抽屉、进会话必须真触摸（touchStart+touchEnd），.click() 无效；
    // 3) 会话行不做文本过滤（未命名会话可能就叫「新会话」），枚举 [role=treeitem] 逐个试触、
    //    每次后看标题簇是否出现，命中即停。
    async function openSession(w, h) {
      await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile: w < 1024 })
      await send('Page.navigate', { url: probeUrl() })
      await waitFn(pgOverlay)
      await sleep(4000) // onboarding 模态比 overlay 晚到，早点了也白点
      for (let round = 0; round < 4; round++) {
        const ob = await call(pgDismiss)
        if (ob) { await tap(ob.x, ob.y); await sleep(1800) }
        if (await call(pgHas, CLUSTER)) return true
        const ham = await call(pgHam)
        if (ham) { await tap(ham.x, ham.y); await sleep(2000) }
        const tree = await call(pgTree)
        for (let i = 0; i < tree.length; i++) {
          const c = await call(pgClick, i)
          if (!c) continue
          await tap(c.x, c.y)
          await sleep(2600)
          if (await call(pgHas, CLUSTER)) return true
        }
      }
      return false
    }

    let x
    check('390px 能进到会话页（有标题簇）', await openSession(390, 844))
    x = await geo()
    check('html[data-xc-hscroll] 已打', x.htmlAttr === true, x.htmlAttr)
    check('cluster overflow-x:auto', x.overflowX === 'auto', x.overflowX)
    check('cluster flex-wrap:nowrap', x.clusterWrap === 'nowrap', x.clusterWrap)
    check('crumbs 地板 min-width:96px', x.crumbsMinWidth === '96px', x.crumbsMinWidth)
    check('actions 不被 100% 撑开（flex-basis:auto）', x.actionsBasis === 'auto', x.actionsBasis)
    check('actions flex-wrap:nowrap', x.actionsWrap === 'nowrap', x.actionsWrap)
    check('槽锚确为 display:contents（两臂并列的前提）', x.anchorDisplay === 'contents', x.anchorDisplay)
    check('徽标根 flex-shrink:0（臂二在位；读数回 1 = 整条规则已被 CSS 解析器丢弃）', x.badgeShrink === '0', x.badgeShrink)
    const rule = await call(pgCssomTwoArms)
    check('CSSOM 里两臂规则存在且恰 2 臂（0612268 冒号事故的回归探针）', !!rule && rule.arms === 2, rule)
    check('页头第一行单行（高度 28-34）', x.rowHeight >= 28 && x.rowHeight <= 34, x.rowHeight)
    check('簇内无常驻弹层节点（否则 mask 被 :has 永久撤）', x.popupNodes === 0, x.popupNodes)
    const base = { cw: x.cw, sw: x.sw, more: x.more } // 真会话可能本来就溢出，占位元素只该在此基础上再加宽

    await call(pgSpacerOn, CLUSTER); await sleep(400)
    x = await geo()
    check('插入 52px 占位 → scrollWidth 真的变宽', x.sw >= base.sw + 40 && x.more === true, { base: base.sw, now: x.sw, cw: x.cw, more: x.more })
    check('人造溢出 → mask 渐隐生效', /linear-gradient/.test(String(x.mask)), String(x.mask).slice(0, 60))
    await call(pgScroll, CLUSTER, 99999); await sleep(400)
    x = await geo()
    check('滑到最右 → more 撤除、mask 归 none', x.more === false && x.mask === 'none', { more: x.more, mask: String(x.mask).slice(0, 40) })
    await call(pgScroll, CLUSTER, 0); await sleep(400)
    x = await geo()
    check('滚回左边 → more 与 mask 重新出现（溢出态可逆）', x.more === true && /linear-gradient/.test(String(x.mask)), { more: x.more, mask: String(x.mask).slice(0, 40) })
    await call(pgSpacerOff); await sleep(400)
    x = await geo()
    check('撤掉占位 → 回到自然基线宽（不是不溢出，而是回到本条会话自己的溢出态）', Math.abs(x.sw - base.sw) <= 3 && x.more === base.more, { base: base.sw, now: x.sw, more: x.more })

    await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true })
    await sleep(600)
    x = await geo()
    check('375px 页头仍单行', x.rowHeight >= 28 && x.rowHeight <= 34, x.rowHeight)
    await send('Emulation.setDeviceMetricsOverride', { width: 380, height: 812, deviceScaleFactor: 2, mobile: true })
    await sleep(600)
    x = await geo()
    check('380px（第三方换行阈值）仍不换行长高', x.rowHeight >= 28 && x.rowHeight <= 34 && x.actionsWrap === 'nowrap', { h: x.rowHeight, wrap: x.actionsWrap })

    await call(pgSetConfig, CONFIG_KEY, CONFIG_OFF)
    await openSession(390, 844)
    x = await geo()
    check('开关关掉 → html 属性摘除', x.htmlAttr === false, x.htmlAttr)
    check('开关关掉 → overflow 回 visible', x.overflowX === 'visible', x.overflowX)
    check('开关关掉 → crumbs 地板撤除（回 vendor 0px）', x.crumbsMinWidth === '0px', x.crumbsMinWidth)
    check('开关关掉 → mask 为 none', x.mask === 'none', x.mask)
    await call(pgDelConfig, CONFIG_KEY)

    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
    await openSession(1440, 900)
    const d = await call(pgDesktopGate, CLUSTER_DESKTOP)
    check('桌面 1440px 能进会话（找到标题簇）', d.found === true, d)
    check('桌面 1440px → 无 html 门栓', d.gate === false, d.gate)
    check('桌面 1440px → overflow 未被改成 auto', d.overflowX !== 'auto', d.overflowX)
    check('桌面 1440px → mask 为 none', d.mask === 'none', d.mask)
    check('桌面 1440px → crumbs 地板未生效（回 vendor 0px）', d.crumbsMin === '0px', d.crumbsMin)
  } finally {
    try { if (ws !== null) ws.close() } catch { /* ignore */ }
    try { child.kill() } catch { /* ignore */ }
  }

  const failed = results.filter(Boolean).length
  console.log('\n[probe-header-swipe] ' + (results.length - failed) + '/' + results.length + ' 通过')
  process.exit(failed ? 1 : 0)
}

main().catch((err) => { console.error('[probe-header-swipe] 运行失败:', redact(err && err.message ? err.message : err)); process.exit(1) })
