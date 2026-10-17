import {test, expect} from '@playwright/test';
import {commonFrame, createRoom, joinRoom, onlineState, openGame, settledInSync, useLowGraphics, watchErrors} from './helpers.js';

test('two browsers create and join a room, start a match and stay in sync', async ({browser}) => {
  // Two CPU-rendered clients share the CI machine: the match runs at ~5 simulated fps there,
  // so reaching the HUD takes ~2.5 minutes and the 216-frame intro ~40 seconds.
  test.setTimeout(600_000);
  const host = await browser.newContext();
  const guest = await browser.newContext();
  await useLowGraphics(host);
  await useLowGraphics(guest);
  const a = await host.newPage();
  const b = await guest.newPage();
  const errors = watchErrors(a, b);
  try {
    await openGame(a);
    await openGame(b);
    const code = await createRoom(a);
    await joinRoom(b, code);

    await expect(a.locator('.on-player')).toHaveCount(2);
    await a.click('button[data-online="ready"]');
    await b.click('button[data-online="ready"]');
    await expect(a.locator('.on-player.is-ready')).toHaveCount(2);
    await expect(a.locator('button[data-online="start"]')).toBeEnabled();
    await a.click('button[data-online="start"]');

    for (const page of [a, b]) await expect(page.locator('.hud')).toBeVisible({timeout: 90_000});
    await expect(a.locator('.hud .p1.you')).toBeAttached();
    await expect(b.locator('.hud .p2.you')).toBeAttached();
    expect((await onlineState(a)).seat).toBe(0);
    expect((await onlineState(b)).seat).toBe(1);

    // Both clients must leave the intro before movement input counts.
    for (const page of [a, b]) await expect(page.locator('#match-symbol')).not.toHaveText('0:00', {timeout: 120_000});
    const before = await settledInSync(a, b, 1);

    // Online play reads the local Player 1 controls on every machine, so both walk with KeyA/KeyD.
    // Hold for a number of simulated frames rather than wall-clock time: CI may run far below 60 fps.
    await a.keyboard.down('KeyD');
    await b.keyboard.down('KeyA');
    const pressed = Math.max((await onlineState(a)).frame, (await onlineState(b)).frame);
    await expect.poll(() => commonFrame(a, b), {timeout: 60_000}).toBeGreaterThanOrEqual(pressed + 30);
    await a.keyboard.up('KeyD');
    await b.keyboard.up('KeyA');
    const released = Math.max((await onlineState(a)).frame, (await onlineState(b)).frame);

    // The simulation advanced, both clients settled the same state, and each fighter moved
    // the way its own player steered it.
    const after = await settledInSync(a, b, released + 1);
    expect(after.hash).not.toBe(before.hash);
    expect(after.x[0], 'host (P1) walked right').toBeGreaterThan(before.x[0]);
    expect(after.x[1], 'guest (P2) walked left').toBeLessThan(before.x[1]);

    // The relay's own simulation checksums a frame past the movement and both clients match it.
    for (const page of [a, b]) {
      await expect.poll(async () => (await onlineState(page)).verifiedHashFrame, {timeout: 60_000}).toBeGreaterThanOrEqual(after.frame);
      expect((await onlineState(page)).desync).toBe('OK');
    }
    expect(errors).toEqual([]);
  } finally {
    await host.close();
    await guest.close();
  }
});
