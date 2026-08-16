/**
 * Generate the app icon used by electron-builder.
 *
 * Reads a source image (default: src/assets/logo.png), center-crops it to a
 * square and writes build/icon.png at 512×512. electron-builder auto-converts
 * that PNG into the Windows .ico (exe, installer, shortcuts, taskbar).
 *
 * Usage:  npm run icon:generate   (or: node scripts/make-icon.mjs [path-to-image])
 */
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const source = process.argv[2] || 'src/assets/logo.png';
const outputDir = path.resolve('build');
const output = path.join(outputDir, 'icon.png');

if (!fs.existsSync(source)) {
  console.error(`Source image not found: ${source}`);
  process.exit(1);
}

fs.mkdirSync(outputDir, { recursive: true });

await sharp(source)
  .resize(512, 512, { fit: 'cover', position: 'centre' })
  .png()
  .toFile(output);

console.log(`✓ Icon written to ${output}`);
console.log('  Next: npm run electron:dist  → icon applied to the .exe and installer.');
