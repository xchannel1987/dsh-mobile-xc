/**
 * keyboard-inset — 软键盘适配（v0.6.16 双模式）。
 *
 * 症状（iPhone 真机）：键盘弹起后 composer 被键盘盖住（大概率），偶尔才落在键盘上沿；
 * 早先版本还有「键盘与输入框之间空隙过大 / 收起后页面停在半空」。
 *
 * 两种浏览器模式（必须同时兼容）：
 *  A. 传统 iOS：键盘只盖住视觉视口，布局视口（innerHeight / 100dvh）纹丝不动。
 *     键盘占位 = innerHeight - visualViewport 可视高（换算回布局 px）。
 *  B. 新 WebKit（2026-08 起支持 interactive-widget，本插件 phone-chrome 声明了
 *     resizes-content）：键盘直接缩小布局视口，innerHeight 与 vv.height 一起变小，
 *     A 的差值公式恒等于 0 —— 0.6.15 及以前在新 iOS 上「大概率不生效」的真因。
 *     此时键盘占位 = 静息布局高(restH) - 当前可视高，且仅在编辑区聚焦时采信
 *     （避免工具栏收展的几十像素被误判）。
 *
 * 做法：以 visualViewport 为准，键盘在场时把 AppFrame 高度改成「可视区高」、帧顶下移
 * offsetTop（帧底边恒等于可视区底边 = 键盘上沿），并清掉 WebKit 为露光标自己加的文档
 * 滚动。两种模式下几何公式统一（frame = 可视区），误判为「有键盘」而实际没有时
 * frame = 整个布局视口，与不介入等价，天然安全。
 *
 * 事件兜底：vv resize/scroll + window resize（模式 B 的布局视口变化）+ focusin 后
 * 限时轮询（iOS 键盘动画期间 vv 事件可能晚到/漏发）+ focusout 两拍还原。
 * 捏合缩放：vv.height/offsetTop 是视觉视口 CSS px，乘 scale 换算回布局 px，
 * 缩放不再被误判成键盘。
 */
const KEYBOARD_MIN = 80
const FRAME_MIN = 120

/** 聚焦后兜底轮询的时间点（ms）：覆盖键盘动画与事件晚到/漏发。 */
const FOCUS_BURST = [60, 180, 360, 600, 900, 1300]

const NON_TEXT_INPUT = new Set(['button', 'checkbox', 'radio', 'range', 'submit', 'reset', 'file', 'image', 'hidden'])

function isEditable(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  if (el.isContentEditable) return true
  if (el instanceof HTMLTextAreaElement) return true
  return el instanceof HTMLInputElement && !NON_TEXT_INPUT.has(el.type)
}

export function installKeyboardInset(): () => void {
  const vv = typeof window === 'undefined' ? null : window.visualViewport
  if (vv === null || vv === undefined) return () => {}
  const root = document.documentElement
  let raf = 0
  let alive = true
  let editableFocused = false
  // 静息布局高：无键盘时见过的最大 innerHeight（模式 B 的键盘占位基准）。
  // 旋转后置 0 重新播种。
  let restH = window.innerHeight

  const setFrame = (px: number | null, top = 0): void => {
    if (px === null) {
      root.style.removeProperty('--dsh-xc-frame-h')
      root.style.removeProperty('--dsh-xc-frame-top')
    } else {
      root.style.setProperty('--dsh-xc-frame-h', Math.max(FRAME_MIN, Math.round(px)) + 'px')
      root.style.setProperty('--dsh-xc-frame-top', Math.round(top) + 'px')
    }
  }

  const apply = (): void => {
    if (!alive) return
    try {
      const layoutH = window.innerHeight
      const scale = vv.scale > 0 ? vv.scale : 1
      // 换算回布局视口 CSS px（scale=1 时与原值相同）
      const visibleH = vv.height * scale
      const visibleTop = vv.offsetTop * scale
      // 模式 A：布局视口不动，键盘 = 布局高 - 可视高。
      // 不能减 offsetTop：iOS 为露光标会先把可视视口下滚，减掉它键盘高度被算成 0
      //（0.6.10 及以前「大部分时候不生效」的真因）。
      const byViewport = layoutH - visibleH
      // 模式 B：布局视口被键盘缩小（resizes-content），差值公式失效；
      // 用静息高基准，且仅在编辑区聚焦时采信（工具栏收展不算键盘）。
      const byLayout = editableFocused ? restH - visibleH : 0
      const keyboard = Math.round(Math.max(byViewport, byLayout))
      if (keyboard >= KEYBOARD_MIN) {
        // 帧高 = 可视区高，帧顶下移 offsetTop：帧底边恒等于可视区底边（= 键盘上沿）
        setFrame(visibleH, visibleTop)
        // 供 CSS 判断键盘状态（底部安全区此时被键盘盖住，不需要再留白）
        if (root.dataset.xcKb !== '1') root.dataset.xcKb = '1'
        root.dataset.xcKbPx = String(keyboard)
        // 键盘期间清掉 WebKit 为露光标自己加的那笔滚动（「关掉键盘回不去」的残留）
        if (window.scrollY !== 0) window.scrollTo(0, 0)
      } else {
        setFrame(null)
        if (root.dataset.xcKb !== undefined) delete root.dataset.xcKb
        if (root.dataset.xcKbPx !== undefined) delete root.dataset.xcKbPx
        // 无键盘且未缩放：播种/抬升静息基准（工具栏收起使 innerHeight 变大时跟随）
        if (scale < 1.01) restH = Math.max(restH, layoutH)
        if (window.scrollY !== 0) window.scrollTo(0, 0)
      }
    } catch {
      /* 任何异常都不允许影响页面 */
    }
  }

  const schedule = (): void => {
    if (raf !== 0 || !alive) return
    raf = requestAnimationFrame(() => {
      raf = 0
      apply()
    })
  }

  const timers: ReturnType<typeof setTimeout>[] = []
  const burst = (points: number[]): void => {
    if (!alive) return
    for (const ms of points) timers.push(setTimeout(apply, ms))
  }

  // 键盘收起时 iOS 的收尾事件常常晚于 focusout，补两拍兜底还原
  const afterBlur = (): void => {
    burst([250, 650])
  }

  const onFocusIn = (event: FocusEvent): void => {
    if (!isEditable(event.target)) return
    editableFocused = true
    // 聚焦即算一拍，再限时轮询兜底（vv 事件晚到/漏发、模式 B 布局视口变化时序）
    schedule()
    burst(FOCUS_BURST)
  }
  const onFocusOut = (event: FocusEvent): void => {
    // 焦点移到另一个编辑区时保持聚焦态（focusin 会随后确认）
    editableFocused = isEditable(event.relatedTarget)
    afterBlur()
  }
  const onOrientation = (): void => {
    restH = 0
    afterBlur()
    burst([400, 900])
  }

  vv.addEventListener('resize', schedule)
  vv.addEventListener('scroll', schedule)
  // 模式 B：键盘缩小的是布局视口，window resize 才是第一信号
  window.addEventListener('resize', schedule)
  document.addEventListener('focusin', onFocusIn, true)
  document.addEventListener('focusout', onFocusOut, true)
  window.addEventListener('orientationchange', onOrientation)
  apply()

  return () => {
    alive = false
    if (raf !== 0) cancelAnimationFrame(raf)
    for (const t of timers) clearTimeout(t)
    vv.removeEventListener('resize', schedule)
    vv.removeEventListener('scroll', schedule)
    window.removeEventListener('resize', schedule)
    document.removeEventListener('focusin', onFocusIn, true)
    document.removeEventListener('focusout', onFocusOut, true)
    window.removeEventListener('orientationchange', onOrientation)
    root.style.removeProperty('--dsh-xc-frame-h')
    root.style.removeProperty('--dsh-xc-frame-top')
    delete root.dataset.xcKb
    delete root.dataset.xcKbPx
  }
}
