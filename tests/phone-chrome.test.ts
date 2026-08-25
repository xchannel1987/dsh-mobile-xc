import { test } from 'node:test'
import assert from 'node:assert/strict'
import { composeViewportContent } from '../src/client/effects/phone-chrome.ts'

test('viewport 内容：基础段齐全', () => {
  const c = composeViewportContent(false)
  assert.ok(c.includes('width=device-width, initial-scale=1'))
  assert.ok(c.includes('viewport-fit=cover'))
  assert.ok(c.includes('interactive-widget=resizes-content'))
})

test('viewport 内容：保留 maximum-scale 锁', () => {
  const c = composeViewportContent(true)
  assert.ok(c.includes('maximum-scale=1'))
})

test('viewport 内容：无锁时不带 maximum-scale', () => {
  const c = composeViewportContent(false)
  assert.ok(!c.includes('maximum-scale'))
})
