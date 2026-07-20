import { Case } from "./cases"
import { FIXTURES } from "./conformance"

//
// Renders a case's data as a self-contained SVG so the docs *show* what GGGCode
// does instead of flattening it to a number list. Three renderers, chosen by tag:
//
//   blit                      -> source grid -> result grid (colour-coded cells),
//                                so flips/rotations/transposes read at a glance
//   ranges|multiaxis|lists    -> a number strip (dots on a line), so the spacing
//                                of stepped/divided sweeps is visible
//   hex|normalized            -> grayscale swatches, so the encoding's brightness
//                                steps are visible
//
// SVGs are written as files and referenced from cases.md with image syntax,
// because GitHub markdown sanitises raw inline <svg>. Each carries its own white
// card background + dark text so it reads on both light and dark GitHub themes.
//

export type Visual = { filename: string, svg: string, alt: string }

// Blit source is the fixed 3x3 [1..9] "bs" fixture; build a value->colour map
// from it so the same value carries the same colour in the result grid.
const BS = FIXTURES.find( f => f.name === "bs" )!.data
const PALETTE = [
  "#e6194b", "#3cb44b", "#ffb000", "#4363d8", "#f58231",
  "#911eb4", "#42a5d4", "#f032e6", "#7bbf45",
]
const NEUTRAL = "#dddddd"

function colourFor( v: number ): string {
  const i = BS.indexOf( v )
  return i >= 0 ? PALETTE[ i % PALETTE.length ] : NEUTRAL
}

// Black or white text depending on the cell's luminance.
function textOn( hex: string ): string {
  const n = parseInt( hex.slice( 1 ), 16 )
  const r = ( n >> 16 ) & 255, g = ( n >> 8 ) & 255, b = n & 255
  const lum = ( 0.299 * r + 0.587 * g + 0.114 * b ) / 255
  return lum > 0.6 ? "#222" : "#fff"
}

function fmt( v: number ): string {
  if ( Number.isInteger( v ) ) return String( v )
  return parseFloat( v.toFixed( 3 ) ).toString()
}

function svgDoc( w: number, h: number, body: string ): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="ui-monospace, monospace">\n` +
    `<rect x="0" y="0" width="${w}" height="${h}" rx="8" fill="#ffffff"/>\n` +
    body +
    "</svg>\n"
}

const CELL = 36

function grid( data: number[], ox: number, oy: number ): string {
  let s = ""
  for ( let i = 0; i < 9; i++ ) {
    const col = i % 3, row = Math.floor( i / 3 )
    const x = ox + col * CELL, y = oy + row * CELL
    const fill = colourFor( data[ i ] )
    s += `<rect x="${x}" y="${y}" width="${CELL - 2}" height="${CELL - 2}" rx="3" fill="${fill}" stroke="#999" stroke-width="0.5"/>\n`
    s += `<text x="${x + CELL / 2 - 1}" y="${y + CELL / 2 + 4}" font-size="13" text-anchor="middle" fill="${textOn( fill )}">${fmt( data[ i ] )}</text>\n`
  }
  return s
}

function label( text: string, x: number, y: number ): string {
  return `<text x="${x}" y="${y}" font-size="12" text-anchor="middle" fill="#555">${text}</text>\n`
}

function renderBlit( c: Case ): Visual {
  const block = 3 * CELL                    // 108
  const arrow = 44
  const ox1 = 12, ox2 = ox1 + block + arrow
  const oy = 30
  const w = ox2 + block + 12, h = oy + block + 12
  const midY = oy + block / 2
  let body = grid( BS, ox1, oy ) + grid( c.values, ox2, oy )
  body += label( "bs (source)", ox1 + block / 2, 20 )
  body += label( "bd (result)", ox2 + block / 2, 20 )
  const ax = ox1 + block + 8, bx = ox2 - 8
  body += `<line x1="${ax}" y1="${midY}" x2="${bx}" y2="${midY}" stroke="#555" stroke-width="2"/>\n`
  body += `<path d="M${bx} ${midY} l-8 -5 v10 z" fill="#555"/>\n`
  return { filename: `${c.name}.svg`, svg: svgDoc( w, h, body ), alt: `${c.name}: blit source to result` }
}

function renderStrip( c: Case ): Visual {
  const vals = c.values
  const padL = 32, padR = 32, w = 480, axisY = 46, h = 76
  const min = Math.min( ...vals ), max = Math.max( ...vals )
  const span = max - min
  const xFor = ( v: number ) => span === 0 ? w / 2 : padL + ( ( v - min ) / span ) * ( w - padL - padR )
  let body = label( `${vals.length} value${vals.length === 1 ? "" : "s"}`, w / 2, 18 )
  body += `<line x1="${padL}" y1="${axisY}" x2="${w - padR}" y2="${axisY}" stroke="#bbb" stroke-width="1"/>\n`
  // Collapse duplicate x positions for labelling, but draw a dot per value.
  for ( const v of vals ) {
    const x = xFor( v )
    body += `<line x1="${x}" y1="${axisY - 5}" x2="${x}" y2="${axisY + 5}" stroke="#4363d8" stroke-width="1"/>\n`
    body += `<circle cx="${x}" cy="${axisY}" r="4" fill="#4363d8"/>\n`
  }
  // Label unique values to avoid overprinting on repeats.
  for ( const v of [ ...new Set( vals ) ] ) {
    body += `<text x="${xFor( v )}" y="${axisY + 20}" font-size="11" text-anchor="middle" fill="#333">${fmt( v )}</text>\n`
  }
  return { filename: `${c.name}.svg`, svg: svgDoc( w, h, body ), alt: `${c.name}: ${vals.map( fmt ).join( ", " )}` }
}

function renderSwatches( c: Case ): Visual {
  const vals = c.values
  const sq = 44, gap = 8, padX = 12, padTop = 12, h = padTop + sq + 22
  const w = padX * 2 + vals.length * sq + ( vals.length - 1 ) * gap
  const max = Math.max( ...vals, 1 )
  const norm = ( v: number ) => max <= 1 ? v : v / max     // 0..1 brightness
  let body = ""
  vals.forEach( ( v, i ) => {
    const x = padX + i * ( sq + gap )
    const g = Math.max( 0, Math.min( 255, Math.round( norm( v ) * 255 ) ) )
    const fill = `rgb(${g},${g},${g})`
    body += `<rect x="${x}" y="${padTop}" width="${sq}" height="${sq}" rx="4" fill="${fill}" stroke="#999" stroke-width="0.5"/>\n`
    body += `<text x="${x + sq / 2}" y="${padTop + sq + 16}" font-size="11" text-anchor="middle" fill="#333">${fmt( v )}</text>\n`
  } )
  return { filename: `${c.name}.svg`, svg: svgDoc( w, h, body ), alt: `${c.name}: ${vals.map( fmt ).join( ", " )}` }
}

// Choose a renderer by tag (first match wins); null = no meaningful visual.
export function visualFor( c: Case ): Visual | null {
  const t = c.tags
  if ( t.includes( "blit" ) && c.values.length === 9 ) return renderBlit( c )
  if ( t.includes( "hex" ) || t.includes( "normalized" ) ) return renderSwatches( c )
  if ( t.includes( "ranges" ) || t.includes( "multiaxis" ) || t.includes( "lists" ) ) {
    if ( c.values.length ) return renderStrip( c )
  }
  return null
}
