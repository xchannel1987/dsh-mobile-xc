import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatCanaryReport } from '../src/client/core/selector-map.ts'
import type { StructuralAnchors, HashedCheck } from '../src/client/core/selector-map.ts'

const OK_STRUCT: StructuralAnchors = { shellOverlay: true, composerSlot: true, frameShape: true }
const OK_HASHED: HashedCheck = { hits: 1, declared: 1, missing: [] }

test('全部正常：返回 null（不打扰）', () => {
  assert.equal(formatCanaryReport(OK_STRUCT, OK_HASHED), null)
})

test('shellOverlay 缺失：告警', () => {
  const report = formatCanaryReport({ ...OK_STRUCT, shellOverlay: false }, OK_HASHED)
  assert.ok(report !== null)
  assert.ok(report.includes('[data-shell-overlay]'))
})

test('frameShape 异常：告警（抽屉定位可能失效）', () => {
  const report = formatCanaryReport({ ...OK_STRUCT, frameShape: false }, OK_HASHED)
  assert.ok(report !== null)
  assert.ok(report.includes('frame 直系子结构异常'))
})

test('composerSlot 缺失：告警', () => {
  const report = formatCanaryReport({ ...OK_STRUCT, composerSlot: false }, OK_HASHED)
  assert.ok(report !== null)
  assert.ok(report.includes('composer data-slot'))
})

test('哈希条目未命中：告警含选择器与兜底', () => {
  const hashed: HashedCheck = {
    hits: 0,
    declared: 1,
    missing: [
      {
        selector: '.fake_hash',
        dshVersion: '0.0.1',
        usedBy: 'test',
        reason: 'n/a',
        fallback: 'structural fallback',
      },
    ],
  }
  const report = formatCanaryReport(OK_STRUCT, hashed)
  assert.ok(report !== null)
  assert.ok(report.includes('.fake_hash'))
  assert.ok(report.includes('structural fallback'))
})

test('多条告警并列展示', () => {
  const hashed: HashedCheck = { hits: 0, declared: 1, missing: [ { selector: '.a', dshVersion: 'x', usedBy: 't', reason: 'r', fallback: 'f' } ] }
  const report = formatCanaryReport({ shellOverlay: false, composerSlot: false, frameShape: true }, hashed)
  assert.ok(report !== null)
  assert.ok(report.includes('3 处'))
})
