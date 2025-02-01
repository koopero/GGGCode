import { existsSync, mkdirSync } from 'fs'
import { cp } from 'fs/promises'
import { dirname, resolve } from 'path'


async function copyPlatformioSource(src, dest) {
  src = resolve(__dirname, "../../cpp", src )
  dest = resolve(__dirname, "../../dist/pio", dest )
  const destDir = dirname(dest)
  existsSync
  if (!existsSync(destDir)) {
    mkdirSync(destDir, { recursive: true } )
  }

  await cp(src, dest, { recursive: true });
}

// Usage
copyPlatformioSource('include', 'include');
copyPlatformioSource('misc/platformio.ini', 'platformio.ini');
copyPlatformioSource('test-pio/', 'test/');
