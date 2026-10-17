import {expect, type BrowserContext, type Page} from '@playwright/test';

/**
 * Saves the "low" graphics setting before the game boots. CI renders WebGL on the CPU
 * (SwiftShader), where bloom and stage lights cost seconds per frame; flows that do not
 * check visuals use this so the simulation keeps a usable frame rate.
 */
export async function useLowGraphics(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    try { localStorage.setItem('abroz-visual-quality', 'low'); } catch { /* Defaults still render. */ }
  });
}

/**
 * Uncaught exceptions and console errors fail a flow; favicon lookups are browser noise.
 * Every page reports into the one returned array, which keeps filling after this call:
 * check it directly, never a copy taken before the flow runs.
 */
export function watchErrors(...pages: Page[]): string[] {
  const errors: string[] = [];
  pages.forEach((page, index) => {
    const label = pages.length > 1 ? `page ${index + 1} ` : '';
    page.on('pageerror', error => errors.push(`${label}pageerror: ${error.message}`));
    page.on('console', message => {
      if (message.type() === 'error' && !/favicon/i.test(message.text())) errors.push(`${label}console: ${message.text()}`);
    });
  });
  return errors;
}

export async function openGame(page: Page): Promise<void> {
  await page.goto('/play');
  await expect(page.locator('button[data-action="training"]')).toBeVisible();
}

/** Home → Training → pick P1 → pick dummy → arena → launch, until the HUD is live. */
export async function startTraining(page: Page, fighter: string, dummy: string): Promise<void> {
  await page.click('button[data-action="training"]');
  await page.click(`button[data-action="pick"][data-id="${fighter}"]`);
  await page.click('button[data-action="confirm-fighter"]');
  await page.click(`button[data-action="pick"][data-id="${dummy}"]`);
  await page.click('button[data-action="confirm-fighter"]');
  await page.click('button[data-action="launch"]');
  await expect(page.locator('.hud')).toBeVisible({timeout: 90_000});
}

export async function createRoom(page: Page): Promise<string> {
  await page.click('button[data-action="online"]');
  await page.click('button[data-online="create"]');
  await page.fill('#on-name', 'E2E arena');
  await page.selectOption('#on-visibility', 'private');
  await page.selectOption('#on-mode', 'ffa');
  await page.selectOption('#on-capacity', '2');
  await page.click('button[data-online="create-submit"]');
  const code = page.locator('.on-room-code strong');
  await expect(code).toHaveText(/^[A-Z0-9]{5}$/);
  return (await code.textContent())!.trim();
}

export async function joinRoom(page: Page, code: string): Promise<void> {
  await page.click('button[data-action="online"]');
  await page.click('button[data-online="code"]');
  await page.fill('#on-code', code);
  await page.click('button[data-online="join-submit"]');
  await expect(page.locator('.on-room-code strong')).toHaveText(code);
}

/** What the development-only `abrozOnlineDebug` hook in main.ts reports about the running online match. */
export interface OnlineState {
  seat: number;
  frame: number;
  /** Latest frame whose inputs every peer has confirmed. */
  settled: number;
  desync: string;
  /** Latest frame whose relay checksum matched this client's confirmed state. */
  verifiedHashFrame: number;
  /** Confirmed state at the requested frame, while it is still in rollback history. */
  hash?: string;
  x?: number[];
}

/** Latest simulated frame that both clients have reached. */
export async function commonFrame(a: Page, b: Page): Promise<number> {
  return Math.min((await onlineState(a)).frame, (await onlineState(b)).frame);
}

export async function onlineState(page: Page, frame?: number): Promise<OnlineState> {
  const state = await page.evaluate(
    at => (window as unknown as {abrozOnlineDebug?: (frame?: number) => OnlineState | undefined}).abrozOnlineDebug?.(at),
    frame,
  );
  if (!state) throw new Error('No online match is running (abrozOnlineDebug is only exposed in development builds).');
  return state;
}

/**
 * Waits until both clients have settled at least `minFrame`, then compares their confirmed
 * state at the latest frame both have settled: hashes and fighter positions must be identical.
 */
export async function settledInSync(a: Page, b: Page, minFrame: number): Promise<{frame: number; hash: string; x: number[]}> {
  let frame = -1;
  await expect.poll(async () => {
    frame = Math.min((await onlineState(a)).settled, (await onlineState(b)).settled);
    return frame;
  }, {timeout: 60_000}).toBeGreaterThanOrEqual(minFrame);
  const [host, guest] = [await onlineState(a, frame), await onlineState(b, frame)];
  expect(host.hash, `confirmed state at frame ${frame} is still in history`).toBeTruthy();
  expect(guest.hash, `guest confirmed hash at frame ${frame}`).toBe(host.hash);
  expect(guest.x, `guest fighter positions at frame ${frame}`).toEqual(host.x);
  return {frame, hash: host.hash!, x: host.x!};
}
