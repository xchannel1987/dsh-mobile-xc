#!/usr/bin/env node
/**
 * rasterize-icons — 官方黑鲸鱼 favicon.svg -> PWA PNG（M5）。
 *
 * 用法：node scripts/rasterize-icons.mjs
 * 依赖：sharp（可选——优先解析项目依赖，找不到则回退本机 DSH 全局安装的 sharp）。
 * 产物：assets/pwa/icon-{192,512,180}.png（深底 #0f172a + 白鲸；512 为 maskable 安全区缩放）
 * 源：默认本机 dsh-web-frontend/dist/favicon.svg（可 DSH_FAVICON_SVG 覆盖）。
 */
import { createRequire } from 'node:module'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function loadSharp() {
  try {
    return require('sharp')
  } catch {
    try {
      return require('C:/Users/zhiqiang.jiang/AppData/Roaming/npm/node_modules/@deepseek-ai/dsh/node_modules/sharp')
    } catch {
      console.error('[rasterize-icons] sharp 不可用：pnpm add -D sharp 或在 DSH 全局安装下运行')
      process.exit(2)
    }
  }
}

const SRC =
  process.env.DSH_FAVICON_SVG ??
  'C:/Users/zhiqiang.jiang/AppData/Roaming/npm/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-web-frontend/dist/favicon.svg'

const BG = '#0f172a'
const OUT_DIR = resolve(root, 'assets/pwa')

function iconSvg(pathD, artScale) {
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">' +
    '<rect width="512" height="512" fill="' + BG + '"/>' +
    '<g transform="translate(256 256) scale(' + artScale + ') translate(-25 -25)">' +
    '<path fill="#ffffff" d="' + pathD + '"/></g></svg>'
  )
}

async function main() {
  const sharp = loadSharp()
  const svg = await readFile(SRC, 'utf8')
  const m = svg.match(/<path[^>]*d="([^"]+)"/)
  if (!m) throw new Error('未在 favicon.svg 中找到 path d')
  const d = m[1]
  await mkdir(OUT_DIR, { recursive: true })

  const targets = [
    { size: 192, scale: 7.9 },
    { size: 180, scale: 7.9 },
    { size: 512, scale: 6.6 },
  ]
  for (const t of targets) {
    const png = await sharp(Buffer.from(iconSvg(d, t.scale))).resize(t.size, t.size).png().toBuffer()
    const out = resolve(OUT_DIR, 'icon-' + t.size + '.png')
    await writeFile(out, png)
    const meta = await sharp(png).metadata()
    console.log('[rasterize-icons] ' + out + '  ' + meta.width + 'x' + meta.height + '  ' + png.length + 'B')
  }
  console.log('[rasterize-icons] 完成（官方黑鲸鱼，深底白鲸）')
}

main().catch((e) => {
  console.error('[rasterize-icons] 失败:', e.message)
  process.exit(1)
})
