/**
 * Copies the instrument artwork the app uses into one bundled module,
 * `src/design-system/artwork.generated.ts`, so badges never fetch an image
 * at runtime and the app ships a few dozen marks instead of the ~3,500 in
 * `simple-icons`.
 *
 *   node scripts/generate-instrument-artwork.mjs
 *
 * Sources (devDependencies, read only here):
 *   - simple-icons (CC0): single-colour brand and coin marks, 24×24 viewBox.
 *   - flag-icons (MIT): square flags, 512×512 viewBox.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(root, 'src/design-system/artwork.generated.ts')

/** Mark kind → simple-icons title. Tickers are mapped in `instrument-marks.ts`. */
const BRANDS = {
  accenture: 'Accenture', adidas: 'Adidas', adyen: 'Adyen', airbnb: 'Airbnb', airbus: 'Airbus',
  alibaba: 'Alibaba.com', amd: 'AMD', americanExpress: 'American Express', arm: 'Arm',
  att: 'AT&T', baidu: 'Baidu', bankOfAmerica: 'Bank of America', block: 'Square', bmw: 'BMW',
  boeing: 'Boeing', booking: 'Booking.com', broadcom: 'Broadcom', cisco: 'Cisco',
  cloudflare: 'Cloudflare', cocaCola: 'Coca-Cola', coinbase: 'Coinbase', datadog: 'Datadog',
  dell: 'Dell', delta: 'Delta', deutscheBank: 'Deutsche Bank', deutscheTelekom: 'Deutsche Telekom',
  dropbox: 'Dropbox', ebay: 'eBay', etsy: 'Etsy', expedia: 'Expedia', fedex: 'FedEx',
  ferrari: 'Ferrari', ford: 'Ford', fortinet: 'Fortinet', generalMotors: 'General Motors',
  goDaddy: 'GoDaddy', goldmanSachs: 'Goldman Sachs', honda: 'Honda', hp: 'HP', hsbc: 'HSBC',
  intel: 'Intel', intuit: 'Intuit', lufthansa: 'Lufthansa', lyft: 'Lyft',
  mastercard: 'MasterCard', mcdonalds: "McDonald's", mongodb: 'MongoDB', nike: 'Nike',
  okta: 'Okta', palantir: 'Palantir', paloAltoNetworks: 'Palo Alto Networks', paypal: 'PayPal',
  pinterest: 'Pinterest', porsche: 'Porsche', qualcomm: 'Qualcomm', reddit: 'Reddit',
  robinhood: 'Robinhood', roblox: 'Roblox', roku: 'Roku', rollsRoyce: 'Rolls-Royce', sap: 'SAP',
  shell: 'Shell', shopify: 'Shopify', siemens: 'Siemens', snapchat: 'Snapchat',
  snowflake: 'Snowflake', sony: 'Sony', spotify: 'Spotify', starbucks: 'Starbucks',
  target: 'Target', toyota: 'Toyota', tripadvisor: 'Tripadvisor', uber: 'Uber',
  unity: 'Unity', ups: 'UPS', verizon: 'Verizon', visa: 'Visa',
  vodafone: 'Vodafone', volkswagen: 'Volkswagen', wix: 'Wix', xiaomi: 'Xiaomi', zoom: 'Zoom',
}

/** Coins drawn as a brand-colour disc. Bitcoin, Ether and EOS are hand-drawn. */
const COINS = {
  algorand: 'Algorand', bitcoinCash: 'Bitcoin Cash', bnb: 'BNB Chain', cardano: 'Cardano',
  chainlink: 'Chainlink', dash: 'Dash', dogecoin: 'Dogecoin', hedera: 'Hedera',
  litecoin: 'Litecoin', monero: 'Monero', polkadot: 'Polkadot', polygon: 'Polygon',
  solana: 'Solana', stellar: 'Stellar', sui: 'Sui', xrp: 'XRP', zcash: 'Zcash',
}

/** Every country a currency or index badge can show (ISO 3166 / `eu`). */
const FLAGS = [
  'ae', 'au', 'br', 'ca', 'ch', 'cl', 'cn', 'co', 'cz', 'de', 'dk', 'es', 'eu', 'fr', 'gb',
  'hk', 'hu', 'id', 'il', 'in', 'it', 'jp', 'kr', 'mx', 'my', 'nl', 'no', 'nz', 'ph', 'pl',
  'ru', 'sa', 'se', 'sg', 'th', 'tr', 'tw', 'us', 'za',
]

/**
 * Hand-simplified flags. `us` draws its stars with <marker>, which
 * react-native-svg does not render; `es` and `mx` carry ~80 KB coats of arms
 * that are invisible at badge size.
 */
const FLAG_OVERRIDES = {
  us: (() => {
    const stars = []
    for (let row = 0; row < 9; row += 1) {
      const even = row % 2 === 0
      for (let col = 0; col < (even ? 6 : 5); col += 1) {
        stars.push(`<circle cx="${(even ? 33 : 65.5) + col * 65}" cy="${17 + row * 30}" r="9"/>`)
      }
    }
    return (
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">' +
      '<path fill="#bd3d44" d="M0 0h512v512H0"/>' +
      '<path stroke="#fff" stroke-width="40" d="M0 58h512M0 137h512M0 216h512M0 295h512M0 374h512M0 453h512"/>' +
      '<path fill="#192f5d" d="M0 0h390v275H0z"/>' +
      `<g fill="#fff">${stars.join('')}</g></svg>`
    )
  })(),
  es:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">' +
    '<path fill="#AA151B" d="M0 0h512v512H0z"/><path fill="#F1BF00" d="M0 128h512v256H0z"/>' +
    '<path fill="#AA151B" d="M130 205h62v80c0 18-14 30-31 30s-31-12-31-30z"/></svg>',
  mx:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">' +
    '<path fill="#006847" d="M0 0h171v512H0z"/><path fill="#fff" d="M171 0h170v512H171z"/>' +
    '<path fill="#ce1126" d="M341 0h171v512H341z"/>' +
    '<path fill="none" stroke="#0c7a3e" stroke-width="12" stroke-linecap="round" d="M206 290c20 40 80 40 100 0"/>' +
    '<ellipse cx="256" cy="244" fill="#8c5a1e" rx="40" ry="46"/></svg>',
}

const DARK = '#111111'

function luminance(hex) {
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

function isGrey(hex) {
  const channels = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16))
  return Math.max(...channels) - Math.min(...channels) < 30
}

const icons = new Map(Object.values(require('simple-icons')).map((icon) => [icon.title, icon]))

function lookup(title) {
  const icon = icons.get(title)
  if (!icon) throw new Error(`simple-icons has no "${title}"`)
  return icon
}

/**
 * Stocks sit on a white plate in their brand colour. Marks too pale for
 * that plate either go dark (white/grey brands) or move onto a disc of
 * their own colour (yellows, limes).
 */
function brandMark(title) {
  const { path, hex } = lookup(title)
  if (contrast(hex, 'FFFFFF') >= 1.6) return { path, plate: '#FFFFFF', fill: `#${hex}` }
  return isGrey(hex) ? { path, plate: '#FFFFFF', fill: DARK } : { path, plate: `#${hex}`, fill: DARK }
}

/** Coins are a white mark on a brand-colour disc, dark when the disc is pale. */
function coinMark(title) {
  const { path, hex } = lookup(title)
  return { path, plate: `#${hex}`, fill: contrast(hex, 'FFFFFF') >= 2 ? '#FFFFFF' : DARK }
}

function flag(code) {
  if (FLAG_OVERRIDES[code]) return FLAG_OVERRIDES[code]
  const file = require.resolve(`flag-icons/flags/1x1/${code}.svg`)
  const svg = readFileSync(file, 'utf8')
    .replace(/\s+id="flag-icons-[a-z]+"/, '')
    .replace(/>\s+</g, '><')
    .replace(/\s+/g, ' ')
    .trim()
  if (/<(marker|mask|pattern|filter|image|text)\b/.test(svg)) {
    throw new Error(`flag ${code} uses an element react-native-svg cannot draw; add an override`)
  }
  return svg
}

function entries(map, build) {
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([kind, title]) => `  ${kind}: ${JSON.stringify(build(title))},`)
    .join('\n')
}

const union = (keys) => keys.sort().map((key) => `'${key}'`).join(' | ')

const source = `// Generated by scripts/generate-instrument-artwork.mjs — do not edit by hand.
// Brand and coin marks: simple-icons (CC0). Flags: flag-icons (MIT).

/** A single-path 24×24 mark drawn \`fill\` on a \`plate\` disc. */
export type ArtworkMark = { path: string; plate: string; fill: string }

export type BrandMarkKind = ${union(Object.keys(BRANDS))}

export type CoinMarkKind = ${union(Object.keys(COINS))}

export type FlagCode = ${union([...FLAGS])}

export const BRAND_MARKS: Record<BrandMarkKind, ArtworkMark> = {
${entries(BRANDS, brandMark)}
}

export const COIN_MARKS: Record<CoinMarkKind, ArtworkMark> = {
${entries(COINS, coinMark)}
}

/** Square SVG documents (512×512 viewBox), clipped to a circle by the badge. */
export const FLAG_SVGS: Record<FlagCode, string> = {
${[...FLAGS].sort().map((code) => `  ${code}: ${JSON.stringify(flag(code))},`).join('\n')}
}
`

writeFileSync(OUT, source)
console.log(`wrote ${OUT} (${(Buffer.byteLength(source) / 1024).toFixed(1)} KB)`)
