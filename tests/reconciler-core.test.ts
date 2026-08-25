import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  createReconcilerCore,
} from '../src/client/core/reconciler-core.ts'
import type { ReconcilerTask } from '../src/client/core/reconciler-core.ts'

/** 手动帧队列：把 flush 压入队列而不是依赖 rAF。 */
function manualFrames() {
  const queue: Array<() => void> = []
  return {
    queue,
    requestFrame: (flush: () => void): (() => void) => {
      queue.push(flush)
      let cancelled = false
      return () => {
        cancelled = true
      }
    },
    flushAll(): void {
      // 模拟一帧：一次性清空当前队列
      const batch = queue.splice(0, queue.length)
      for (const fn of batch) fn()
    },
  }
}

function task(name: string, scopes?: readonly string[]): ReconcilerTask & { runs: number } {
  return {
    name,
    scopes,
    runs: 0,
    ensure() {
      this.runs++
    },
    dispose() {
      this.runs = 0
    },
  }
}

test('register/remove：注册后 size 增长，移除后不再执行', () => {
  const f = manualFrames()
  const core = createReconcilerCore({ requestFrame: f.requestFrame })
  const t = task('a', ['x'])
  assert.equal(core.size, 0)
  const remove = core.register(t)
  assert.equal(core.size, 1)
  remove()
  assert.equal(core.size, 0)
})

test('activate 立即执行全部任务（forceAll）', () => {
  const f = manualFrames()
  const core = createReconcilerCore({ requestFrame: f.requestFrame })
  const t = task('a', ['x'])
  core.register(t)
  core.activate()
  f.flushAll()
  assert.equal(t.runs, 1)
})

test('note 只触发 scope 相交的任务；无关键不触发', () => {
  const f = manualFrames()
  const core = createReconcilerCore({ requestFrame: f.requestFrame })
  const inScope = task('in', ['a'])
  const out = task('out', ['b'])
  core.register(inScope)
  core.register(out)
  core.activate()
  f.flushAll()
  assert.equal(inScope.runs, 1)
  assert.equal(out.runs, 1)

  core.note(['a'])
  f.flushAll()
  assert.equal(inScope.runs, 2)
  assert.equal(out.runs, 1)

  core.note(['b'])
  f.flushAll()
  assert.equal(out.runs, 2)
})

test('多帧 note 合并为一次 flush（rAF 合并）', () => {
  const f = manualFrames()
  const core = createReconcilerCore({ requestFrame: f.requestFrame })
  const t = task('a', ['x'])
  core.register(t)
  core.activate()
  f.flushAll()
  const before = t.runs
  core.note(['x'])
  core.note(['x'])
  core.note(['x'])
  assert.equal(f.queue.length, 1, '多次 note 只调度一帧')
  f.flushAll()
  assert.equal(t.runs, before + 1)
})

test('错误隔离：单个 task 抛错不影响其他任务且不中断 flush', () => {
  const f = manualFrames()
  const errors: string[] = []
  const core = createReconcilerCore({
    requestFrame: f.requestFrame,
    onError: (name, _e, phase) => errors.push(name + '/' + phase),
  })
  const bad: ReconcilerTask = {
    name: 'bad',
    ensure() {
      throw new Error('boom')
    },
    dispose() {},
  }
  const good = task('good', ['x'])
  core.register(bad)
  core.register(good)
  core.activate()
  f.flushAll()
  assert.equal(errors.join(','), 'bad/ensure')
  assert.equal(good.runs, 1)
})

test('deactivate：dispose 所有激活任务、清脏键、取消挂起帧', () => {
  const f = manualFrames()
  const core = createReconcilerCore({ requestFrame: f.requestFrame })
  const t = task('a', ['x'])
  core.register(t)
  core.activate()
  f.flushAll()
  core.note(['x'])
  assert.ok(f.queue.length > 0)
  core.deactivate()
  assert.equal(t.runs, 0, 'dispose 已回调（runs 归零）')
  f.flushAll()
  assert.equal(t.runs, 0, 'deactivate 后 flush 不再执行任务')
})

test('unscoped 任务每轮都执行', () => {
  const f = manualFrames()
  const core = createReconcilerCore({ requestFrame: f.requestFrame })
  const t = task('always')
  core.register(t)
  core.activate()
  f.flushAll()
  core.note(['anything'])
  f.flushAll()
  assert.equal(t.runs, 2)
})
