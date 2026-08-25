#!/usr/bin/env node
/**
 * verify-lib — lib/ 漂移检查（esbuild JS API）。
 * 用法：
 *   node scripts/verify-lib.mjs          # 只检查：构建内存产物与 lib/ 比对，不一致则非零退出
 *   node scripts/verify-lib.mjs --write  # 刷新 lib/（npm run build 尾步已带）
 */
import { build } from 'esbuild'
import { createHash } from 'node:crypto'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const write = process.argv.includes('--write')

const targets = [
  {
    out: resolve(root, 'lib/index.js'),
    options: {
      entryPoints: [resolve(root, 'src/index.ts')],
      bundle: true,
      platform: 'node',
      format: 'esm',
    },
  },
  {
    out: resolve(root, 'lib/client.js'),
    options: {
      entryPoints: [resolve(root, 'src/client/index.ts')],
      bundle: true,
      platform: 'browser',
      format: 'iife',
      external: ['react'],
    },
  },
]

function sha1(text) {
  return createHash('sha1').update(text, 'utf8').digest('hex')
}

let failed = false
for (const target of targets) {
  const result = await build({ ...target.options, write: false, logLevel: 'silent' })
  const code = result.outputFiles[0].text
  const want = sha1(code)
  let have = null
  if (existsSync(target.out)) {
    have = sha1(await readFile(target.out, 'utf8'))
  }
  if (have === want) {
    console.log('[verify-lib] OK  ' + target.out.replace(root, '.'))
  } else if (write) {
    await mkdir(dirname(target.out), { recursive: true })
    await writeFile(target.out, code)
    console.log('[verify-lib] WRITE ' + target.out.replace(root, '.') + ' (' + want.slice(0, 12) + ')')
  } else {
    failed = true
    console.error(
      '[verify-lib] DRIFT ' +
        target.out.replace(root, '.') +
        ': lib=' +
        (have ? have.slice(0, 12) : 'missing') +
        ' build=' +
        want.slice(0, 12) +
        ' —— 先跑 npm run build',
    )
  }
}
process.exit(failed ? 1 : 0)
