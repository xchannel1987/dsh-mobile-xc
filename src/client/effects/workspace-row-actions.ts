/**
 * workspace-row-actions — 工作区行操作按钮（已归档会话 / 新建会话）的触屏显隐。
 *
 * 背景：0.2.2 vendor CSS 在 @media (hover:none) 下把 .YDXeBa_rowActions 对**所有已展开**
 * 工作区行常显（只有 [aria-expanded=false] 才隐藏），与 0.2.1 以前「只有点中的行才显示」
 * 的交互不一致。触屏没有 hover，靠 sticky :hover 不可靠，所以这里显式记录「最后点中的
 * 工作区行」：pointerdown 命中 .YDXeBa_projectRow 时给它打 data-xc-ws-tapped，
 * 并清掉其它行；CSS 只对带标记的行（或 :hover / 行菜单打开）显示按钮组。
 *
 * 行是虚拟列表节点，重新渲染会丢标记——用户再点一次即可，无需持久化。
 */
const ROW = '.YDXeBa_projectRow'
const MARK = 'data-xc-ws-tapped'

export function installWorkspaceRowActions(): () => void {
  if (typeof document === 'undefined') return () => {}

  const clear = (): void => {
    for (const el of document.querySelectorAll('[' + MARK + ']')) el.removeAttribute(MARK)
  }

  const onPointerDown = (event: Event): void => {
    const target = event.target
    if (!(target instanceof Element)) return
    const row = target.closest(ROW)
    if (row === null) {
      // 点到别处：收起按钮组（离开工作区列表时也符合「选中才显示」）
      clear()
      return
    }
    if (row.getAttribute(MARK) === '') return
    clear()
    row.setAttribute(MARK, '')
  }

  document.addEventListener('pointerdown', onPointerDown, true)
  return () => {
    document.removeEventListener('pointerdown', onPointerDown, true)
    clear()
  }
}
