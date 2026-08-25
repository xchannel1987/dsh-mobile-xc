/**
 * gesture — M4 手势层（决策 2：一键 swipe 默认，跟手拖拽实现但默认关）。
 *
 * 原则（odefined 教科书做法）：全 passive、永不 preventDefault、方向锁、
 * 跳过表单控件 / 横向可滚动区（pre/table）、让位屏幕边缘（系统返回手势）。
 * 跟手模式（GESTURE.dragEnabled）激活时动态 touch-action:none 夺回手势，
 * 结束恢复（对治 glass 拖拽抖动根因）；手势只改浮层位置，状态仍走 layout.toggleSidebar()（DR10）。
 */
import type { EffectHost } from '../breakpoints.ts'
import { installMobileEffect } from '../breakpoints.ts'
import { GESTURE } from '../config.ts'

const EDGE_IGNORE_PX = 16

interface DragState {
  startX: number
  startY: number
  active: boolean
  fired: boolean
  pointer: number
  open: boolean
  logical: boolean
  lastX: number
  lastT: number
  velocity: number
  drawer: HTMLElement | null
  width: number
}

export function installMobileGesture(ctx: EffectHost, toggleSidebar: () => void): void {
  installMobileEffect(ctx, 'dsh-mobile-xc: gesture', () => {
    let drag: DragState | null = null

    const modalOpen = (): boolean => document.querySelector('[aria-modal="true"]') !== null
    const drawerOpen = (): boolean => {
      const f = document.querySelector('[data-shell-overlay]')?.parentElement
      return f !== null && f !== undefined && !f.hasAttribute('data-sidebar-collapsed')
    }
    const drawerEl = (): HTMLElement | null =>
      document.querySelector<HTMLElement>('[data-mobile-nav="frame"] > [data-mobile-nav="drawer"]')

    const isHScrollable = (el: Element): boolean => {
      let n: Element | null = el
      while (n !== null && n !== document.body) {
        if (n.scrollWidth > n.clientWidth + 2) {
          const ox = getComputedStyle(n).overflowX
          if (ox === 'auto' || ox === 'scroll') return true
        }
        n = n.parentElement
      }
      return false
    }
    const shouldSkip = (target: EventTarget | null): boolean => {
      if (!(target instanceof Element)) return true
      if (target.closest('textarea, input, select, button, [contenteditable], [data-mobile-nav="ham"]') !== null) {
        return true
      }
      return isHScrollable(target)
    }

    const onDown = (event: PointerEvent): void => {
      if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return
      if (!event.isPrimary) return
      if (modalOpen()) return
      if (event.clientX < EDGE_IGNORE_PX) return
      if (shouldSkip(event.target)) return
      drag = {
        startX: event.clientX,
        startY: event.clientY,
        active: false,
        fired: false,
        pointer: event.pointerId,
        open: drawerOpen(),
        logical: drawerOpen(),
        lastX: event.clientX,
        lastT: event.timeStamp,
        velocity: 0,
        drawer: null,
        width: 0,
      }
    }

    const settle = (d: DragState, wantOpen: boolean): void => {
      if (wantOpen !== d.logical) {
        toggleSidebar()
        d.logical = wantOpen
      }
      const el = d.drawer
      if (el !== null) {
        const target = wantOpen ? 0 : -el.getBoundingClientRect().width * 1.1
        requestAnimationFrame(() => {
          el.style.transition = 'transform .28s cubic-bezier(.32, .72, .24, 1)'
          el.style.transform = 'translateX(' + target + 'px)'
        })
        if (d.logical) {
          window.setTimeout(() => {
            el.style.transition = ''
            el.style.transform = ''
          }, 340)
        }
      }
      document.documentElement.style.touchAction = ''
    }

    const onMove = (event: PointerEvent): void => {
      const d = drag
      if (d === null || d.pointer !== event.pointerId) return
      const dx = event.clientX - d.startX
      const dy = event.clientY - d.startY
      if (!d.active) {
        if (Math.abs(dx) < 3 && Math.abs(dy) < 3) return
        if (Math.abs(dy) > Math.abs(dx)) {
          drag = null
          return // 垂直滚动意图，交给原生
        }
        if (d.fired) return
        if (Math.abs(dx) < GESTURE.swipeThresholdPx) return
        if (!GESTURE.dragEnabled) {
          // 一次性 swipe：关闭中向右滑开、打开中向左滑关；同向不动作
          const swipingRight = dx > 0
          if (!d.open && swipingRight) toggleSidebar()
          else if (d.open && !swipingRight) toggleSidebar()
          d.fired = true
          return
        }
        // 跟手模式：激活（先翻转逻辑态，锁定 width 与手势）
        d.active = true
        if (!d.logical) {
          toggleSidebar()
          d.logical = true
        }
        d.drawer = drawerEl()
        d.width = d.drawer === null ? 300 : d.drawer.getBoundingClientRect().width
        document.documentElement.style.touchAction = 'none'
        if (d.drawer !== null) d.drawer.style.transition = 'none'
      }
      if (!d.active || d.drawer === null) return
      const raw = (d.logical ? d.width : 0) + dx
      const next = Math.max(0, Math.min(d.width, raw))
      d.drawer.style.transform = 'translateX(' + next + 'px)'
      const dt = Math.max(1, event.timeStamp - d.lastT)
      d.velocity = (event.clientX - d.lastX) / dt
      d.lastX = event.clientX
      d.lastT = event.timeStamp
    }

    const finish = (d: DragState, event: PointerEvent): void => {
      drag = null
      if (d.fired || !d.active) {
        document.documentElement.style.touchAction = ''
        return
      }
      const el = d.drawer
      const w = d.width
      const pos = el === null ? 0 : Number.parseFloat((el.style.transform.match(/-?\d+(\.\d+)?/) ?? ['0'])[0])
      const percent = w > 0 ? Math.max(0, Math.min(1, pos / w)) : 0
      let want: boolean
      if (d.velocity > 0.4) want = true
      else if (d.velocity < -0.4) want = false
      else want = percent > 0.5
      void event
      settle(d, want)
    }

    const onUp = (event: PointerEvent): void => {
      if (drag === null || drag.pointer !== event.pointerId) return
      finish(drag, event)
    }

    const onCancel = (event: PointerEvent): void => {
      if (drag === null || drag.pointer !== event.pointerId) return
      const d = drag
      drag = null
      document.documentElement.style.touchAction = ''
      if (d.active && d.drawer !== null) {
        d.drawer.style.transition = ''
        d.drawer.style.transform = ''
      }
    }

    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('pointermove', onMove, true)
    window.addEventListener('pointerup', onUp, true)
    window.addEventListener('pointercancel', onCancel, true)
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('pointermove', onMove, true)
      window.removeEventListener('pointerup', onUp, true)
      window.removeEventListener('pointercancel', onCancel, true)
    }
  })
}
