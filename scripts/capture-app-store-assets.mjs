// Install Playwright in your capture environment, or set CAPTURE_PLAYWRIGHT_MODULE
// to its module URL. Preview encoding also requires ffmpeg on PATH.
const { chromium } = await import(process.env.CAPTURE_PLAYWRIGHT_MODULE || 'playwright');
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const output = path.join(root, 'fresh-app-store-assets', '2026-10-15', 'screenshots');
await mkdir(output, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 428, height: 926 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  colorScheme: 'light',
});
const page = await context.newPage();

const settle = async () => {
  await page.evaluate(() => document.fonts?.ready);
  // Let the shared 1100 ms amount count-up and staggered reveals finish.
  await page.waitForTimeout(1600);
};

const capture = async (name) => {
  await settle();
  await page.screenshot({
    path: path.join(output, name),
    type: 'png',
    fullPage: false,
    animations: 'disabled',
  });
  console.log(`Captured ${name}`);
};

await page.goto(process.env.CAPTURE_URL || 'http://127.0.0.1:8084', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Open account' }).waitFor();

await capture('01-home.png');

await page.getByRole('button', { name: 'Deposit', exact: true }).click();
await page.getByText('Add funds to your trading account', { exact: true }).waitFor();
await capture('02-funding.png');
await page.getByRole('button', { name: 'Close', exact: true }).click();

await page.getByRole('button', { name: 'Markets', exact: true }).last().click();
await page.getByRole('heading', { name: 'Markets', exact: true }).waitFor();
await capture('03-markets.png');

await page.getByRole('button', { name: 'XAU/USD Gold 2,387.42 +0.34%', exact: true }).click();
await page.getByText('Gold / US Dollar', { exact: true }).first().waitFor();
await capture('04-instrument.png');
await page.getByRole('button', { name: 'Go back', exact: true }).click();

await page.getByRole('button', { name: 'Trade', exact: true }).last().click();
await page.getByRole('heading', { name: 'Trade', exact: true }).waitFor();
await capture('05-trade.png');

await page.getByRole('button', { name: 'Buy at 2,387.72', exact: true }).click();
await page.getByRole('heading', { name: 'Buy XAU/USD', exact: true }).waitFor();
await capture('06-order-review.png');
await page.getByRole('button', { name: 'Close', exact: true }).click();

await page.getByRole('button', { name: 'Positions', exact: true }).last().click();
await page.getByRole('heading', { name: 'Positions', exact: true }).waitFor();
await capture('07-positions.png');

await page.getByRole('button', { name: 'Home', exact: true }).last().click();
await page.getByRole('button', { name: 'Activity', exact: true }).click();
await page.getByRole('heading', { name: 'Activity', exact: true }).waitFor();
await capture('08-activity.png');
await page.getByRole('button', { name: 'Back', exact: true }).click();

await page.getByRole('button', { name: 'Balance', exact: true }).click();
await page.getByRole('heading', { name: 'Balance', exact: true }).waitFor();
await capture('09-balance.png');
await page.reload({ waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Open account' }).waitFor();

await page.getByRole('button', { name: 'More', exact: true }).last().click();
await capture('10-account.png');

await browser.close();
