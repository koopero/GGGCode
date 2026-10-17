import { cp, rm } from "fs/promises"
import { resolve } from "path"


async function copyPlatformioSource(src, dest) {
  src = resolve(__dirname, "../../cxx", src )
  dest = resolve(__dirname, "../../dist/pio", dest )

  // Clear any previous copy before writing. bun's fs.cp MERGES into an existing
  // directory without replacing files already there, which silently left
  // dist/pio/test (and include) running stale sources -- `npm run test:pio`
  // would pass against old code. Removing the destination first guarantees a
  // rebuild always reflects the current source. The pio build cache lives in
  // dist/pio/.pio, which this never touches.
  await rm( dest, { recursive: true, force: true } )
  await cp( src, dest, { recursive: true, force: true } )
}

// Usage
await copyPlatformioSource("include", "include")
await copyPlatformioSource("misc/platformio.ini", "platformio.ini")
await copyPlatformioSource("test-pio/", "test/")
