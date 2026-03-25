#!/usr/bin/env node
/**
 * Generates PWA icons using Canvas API via node-canvas.
 * Falls back to writing placeholder PNGs if canvas unavailable.
 */
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ICONS_DIR = join(__dirname, '..', 'public', 'icons')
mkdirSync(ICONS_DIR, { recursive: true })

// SVG icon: Om symbol on dark background with gold color
const svgIcon = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${size * 0.2}" fill="#0F0F0F"/>
  <text
    x="50%"
    y="54%"
    dominant-baseline="middle"
    text-anchor="middle"
    font-size="${size * 0.55}"
    fill="#C8922A"
    font-family="serif"
  >ॐ</text>
</svg>`

writeFileSync(join(ICONS_DIR, 'icon.svg'), svgIcon(512))
console.log('✓ Generated icon.svg')

// Write SVG as favicon too
writeFileSync(join(__dirname, '..', 'public', 'favicon.svg'), svgIcon(64))
console.log('✓ Generated favicon.svg')

// For PNG icons, we'll use a simple approach: write the SVG and note that
// a build step or manual conversion is needed for actual PNG.
// For now, copy SVG content as placeholder (browsers accept SVG favicons).
console.log('Note: For PNG icons (icon-192.png, icon-512.png), convert icon.svg using:')
console.log('  npx sharp-cli --input public/icons/icon.svg --output public/icons/icon-192.png resize 192 192')
console.log('  npx sharp-cli --input public/icons/icon.svg --output public/icons/icon-512.png resize 512 512')
