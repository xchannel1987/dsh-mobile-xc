#!/usr/bin/env node
/**
 * probe-keyboard-modes — keyboard.ts 双模式几何离线门禁（开发调试用，不进生产构建）。
 * 用 mock window/visualViewport 重放 iOS 两种键盘模式 + 缩放/工具栏/失焦场景。
 * 运行：node --experimental-strip-types scripts/probe-keyboard-modes.mjs
 */
// ---- DOM mocks ----
class HTMLElement { constructor(){ this.isContentEditable = false } blur(){} }
class HTMLTextAreaElement extends HTMLElement {}
class HTMLInputElement extends HTMLElement { constructor(type='text'){ super(); this.type = type } }
globalThis.HTMLElement = HTMLElement
globalThis.HTMLTextAreaElement = HTMLTextAreaElement
globalThis.HTMLInputElement = HTMLInputElement

const listeners = { vv: {}, win: {}, doc: {} }
const mkReg = (bag) => ({
  addEventListener: (t, f) => { (bag[t] ??= []).push(f) },
  removeEventListener: (t, f) => { bag[t] = (bag[t] ?? []).filter(x => x !== f) },
})
const vv = { height: 844, offsetTop: 0, scale: 1, ...mkReg(listeners.vv) }
const styleProps = new Map()
const dataset = {}
const root = {
  style: {
    setProperty: (k, v) => styleProps.set(k, v),
    removeProperty: (k) => styleProps.delete(k),
  },
  dataset,
}
globalThis.document = {
  documentElement: root,
  activeElement: null,
  ...mkReg(listeners.doc),
}
globalThis.window = {
  innerHeight: 844,
  scrollY: 0,
  scrollTo: () => {},
  visualViewport: vv,
  ...mkReg(listeners.win),
}
// 同步执行 cb 后返回 0：模拟「帧已消费」，避免返回值把 raf 永久钉成非 0
globalThis.requestAnimationFrame = (cb) => { cb(); return 0 }
globalThis.cancelAnimationFrame = () => {}

const dispatch = (bag, type, ev = {}) => { for (const f of bag[type] ?? []) f(ev) }
const setViewport = ({ inner, h, top = 0, scale = 1 }) => {
  if (inner !== undefined) window.innerHeight = inner
  vv.height = h; vv.offsetTop = top; vv.scale = scale
  dispatch(listeners.vv, 'resize')
  dispatch(listeners.win, 'resize')
}
const focusIn = (el) => dispatch(listeners.doc, 'focusin', { target: el })
const focusOut = (related = null) => dispatch(listeners.doc, 'focusout', { relatedTarget: related })

const { installKeyboardInset } = await import('../src/client/effects/keyboard.ts')
const dispose = installKeyboardInset()

const results = []
const check = (label, ok, detail='') => { results.push(ok); console.log((ok?'PASS':'FAIL')+'  '+label+(detail?'  ['+detail+']':'')) }
const frameH = () => styleProps.get('--dsh-xc-frame-h') ?? null
const frameTop = () => styleProps.get('--dsh-xc-frame-top') ?? null
const kb = () => dataset.xcKb ?? null
const textarea = new HTMLTextAreaElement()
const ce = new HTMLElement(); ce.isContentEditable = true

// 0) 静息：无介入
check('静息：无帧高变量', frameH() === null && kb() === null)

// 1) 模式 A（传统 iOS）：布局视口不动，vv 缩小
focusIn(textarea)
setViewport({ inner: 844, h: 500 })
check('模式A：kb=1 帧高=500', kb() === '1' && frameH() === '500px', 'h='+frameH())

// 2) 模式 A + WebKit 下滚露光标（offsetTop>0）：键盘高度不被 offsetTop 吃掉
setViewport({ inner: 844, h: 500, top: 120 })
check('模式A+offsetTop：kb=1 帧高=500 帧顶=120', kb() === '1' && frameH() === '500px' && frameTop() === '120px', 'h='+frameH()+' top='+frameTop())

// 3) 失焦还原
focusOut()
setViewport({ inner: 844, h: 844, top: 0 })
check('收起：变量清除', frameH() === null && frameTop() === null && kb() === null)

// 4) 模式 B（新 WebKit resizes-content）：innerHeight 与 vv 一起缩小
focusIn(ce)
setViewport({ inner: 500, h: 500 })
check('模式B：kb=1 帧高=500（旧公式在此恒为0）', kb() === '1' && frameH() === '500px', 'h='+frameH()+' px='+dataset.xcKbPx)
check('模式B：键盘占位=344', dataset.xcKbPx === '344', 'px='+dataset.xcKbPx)

// 5) 模式 B 收起
focusOut()
setViewport({ inner: 844, h: 844 })
check('模式B收起：变量清除', frameH() === null && kb() === null)

// 6) 工具栏收展（无聚焦、60px 变化）：不介入
setViewport({ inner: 784, h: 784 })
check('工具栏收缩60px：不介入', frameH() === null && kb() === null)
setViewport({ inner: 844, h: 844 })

// 7) 捏合缩放（scale=2，vv.height 减半）：不误判为键盘
setViewport({ inner: 844, h: 422, scale: 2 })
check('捏合缩放2x：不误判', frameH() === null && kb() === null)
setViewport({ inner: 844, h: 844, scale: 1 })

// 8) 缩放状态下的真实键盘（模式A，scale=1.5）：换算后仍正确
focusIn(textarea)
setViewport({ inner: 844, h: 333, scale: 1.5 })  // 333*1.5≈500 可视高
check('缩放+键盘：帧高≈500', kb() === '1' && frameH() === '500px', 'h='+frameH())
focusOut()
setViewport({ inner: 844, h: 844, scale: 1 })

// 9) 编辑区间切换焦点（relatedTarget 仍是编辑区）：键盘态保持
focusIn(textarea)
setViewport({ inner: 844, h: 500 })
focusOut(new HTMLTextAreaElement())
dispatch(listeners.vv, 'resize')
check('编辑区切换：键盘态保持', kb() === '1')
focusOut()
setViewport({ inner: 844, h: 844 })

// 10) 旋转重播种：横屏静息高 390，再弹键盘
dispatch(listeners.win, 'orientationchange')
setViewport({ inner: 390, h: 390 })
focusIn(textarea)
setViewport({ inner: 390, h: 200 })
check('旋转后模式A：帧高=200', kb() === '1' && frameH() === '200px', 'h='+frameH())
focusOut()
setViewport({ inner: 390, h: 390 })

// 11) 卸载清理
dispose()
check('卸载：变量/标记清空', frameH() === null && kb() === null && dataset.xcKbPx === undefined)

const failed = results.filter(r => !r).length
console.log('\n[probe-keyboard-modes] ' + (results.length - failed) + '/' + results.length + ' 通过')
process.exit(failed ? 1 : 0)
