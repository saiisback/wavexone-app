// Install Playwright in your capture environment, or set CAPTURE_PLAYWRIGHT_MODULE
// to its module URL. Preview encoding also requires ffmpeg on PATH.
const { chromium } = await import(process.env.CAPTURE_PLAYWRIGHT_MODULE || 'playwright');
import { mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const output = path.join(process.cwd(), 'fresh-app-store-assets', '2026-10-15', 'previews');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const url = process.env.CAPTURE_URL || 'http://127.0.0.1:8084';
if (!['localhost', '127.0.0.1'].includes(new URL(url).hostname)) throw new Error('Capture requires a local demo server');

async function record(name, flow) {
  if (process.env.PREVIEW_ONLY && process.env.PREVIEW_ONLY !== name) return;
  const context = await browser.newContext({
    viewport: { width: 443, height: 960 },
    deviceScaleFactor: 2,
    isMobile: true, hasTouch: true, colorScheme: 'light',
    recordVideo: { dir: path.join(output, 'raw'), size: { width: 443, height: 960 } },
  });
  // These videos must never issue requests to real trading or funding servers.
  await context.route('https://trade.wavexone.com/**', route => route.abort());
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Open account', exact: true }).waitFor();
  if (!(await page.locator('body').innerText()).includes('WX012345')) throw new Error('Expected demo account');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1800);
  const started = Date.now();
  await flow(page);
  const remaining = 22000 - (Date.now() - started);
  if (remaining > 0) await page.waitForTimeout(remaining);
  const video = page.video();
  await context.close();
  const raw = await video.path();
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', '2', '-i', raw,
    '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
    '-t', '20', '-vf', 'scale=886:1920:flags=lanczos,setsar=1,fps=30',
    '-c:v', 'libx264', '-profile:v', 'high', '-level:v', '4.0', '-crf', '18',
    '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart',
    path.join(output, `${name}.mp4`)], { stdio: 'inherit' });
  console.log(`Recorded ${name}: 20 seconds, 886x1920, H.264/AAC`);
}

try {
  await record('01-overview', async page => {
    await page.waitForTimeout(6000);
    await page.getByRole('button', { name: 'Balance', exact: true }).click();
    await page.getByRole('heading', { name: 'Balance', exact: true }).waitFor();
    await page.waitForTimeout(6000);
    await page.getByRole('button', { name: 'Deposit', exact: true }).click();
    await page.getByText('Add funds to your trading account', { exact: true }).waitFor();
  });
  await record('02-discover-and-trade', async page => {
    await page.getByRole('button', { name: 'Markets', exact: true }).last().click();
    await page.getByRole('heading', { name: 'Markets', exact: true }).waitFor();
    await page.waitForTimeout(6000);
    await page.getByRole('button', { name: 'XAU/USD Gold 2,387.42 +0.34%', exact: true }).click();
    await page.getByText('Gold / US Dollar', { exact: true }).first().waitFor();
    await page.waitForTimeout(7000);
    await page.getByRole('button', { name: 'Buy 2,387.72', exact: true }).click();
    await page.getByRole('heading', { name: 'Buy XAU/USD', exact: true }).waitFor();
  });
  await record('03-positions-and-account', async page => {
    await page.getByRole('button', { name: 'Positions', exact: true }).last().click();
    await page.getByRole('heading', { name: 'Positions', exact: true }).waitFor();
    await page.waitForTimeout(7000);
    await page.getByRole('button', { name: 'More', exact: true }).last().click();
    await page.getByText('Jonathan Reed', { exact: true }).waitFor();
    await page.waitForTimeout(6000);
    await page.getByRole('button', { name: 'Activity', exact: true }).click();
    await page.getByRole('heading', { name: 'Activity', exact: true }).waitFor();
  });
} finally {
  await browser.close();
}
