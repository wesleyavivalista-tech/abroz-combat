import {test, expect} from '@playwright/test';
import {characters} from '../../packages/game-core/characters/registry.js';
import {openGame, startTraining, useLowGraphics, watchErrors} from './helpers.js';

test('training match loads both fighters, advances the clock, pauses and resumes', async ({page}) => {
  const errors = watchErrors(page);
  await openGame(page);
  await startTraining(page, 'gut', 'tocha');

  await expect(page.locator('.hud .p1 .fighter-name b')).toHaveText('GUT');
  await expect(page.locator('.hud .p2 .fighter-name b')).toHaveText('TOCHA');
  await expect(page.locator('#health0')).toBeAttached();
  await expect(page.locator('#health1')).toBeAttached();

  // The simulation clock only advances while the fixed-tick loop is running.
  await expect(page.locator('#match-symbol')).not.toHaveText('0:00', {timeout: 30_000});

  // Walk toward the dummy and attack; the client must stay error free under input.
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(1500);
  await page.keyboard.up('KeyD');
  for (const key of ['KeyJ', 'KeyJ', 'KeyJ', 'KeyK', 'KeyL']) {
    await page.keyboard.press(key);
    await page.waitForTimeout(150);
  }

  await page.keyboard.press('Escape');
  const pause = page.locator('dialog#pause');
  await expect(pause).toHaveAttribute('open', '');
  await pause.locator('button[data-action="pause"]').click();
  // Resuming removes the dialog entirely; absent or closed both count as resumed.
  await expect(pause).not.toBeVisible();

  await page.keyboard.press('Escape');
  await expect(pause).toHaveAttribute('open', '');
  await pause.locator('button[data-action="home"]').click();
  await expect(page.locator('button[data-action="training"]')).toBeVisible();
  expect(errors).toEqual([]);
});

// One test per fighter, so a failure names the fighter and retries only that case.
test.describe('every fighter can enter training against the same dummy', () => {
  test.beforeEach(async ({context}) => useLowGraphics(context));
  for (const fighter of Object.keys(characters).sort()) {
    test(fighter, async ({page}) => {
      const errors = watchErrors(page);
      await openGame(page);
      await startTraining(page, fighter, 'gut');
      await expect(page.locator('.hud .p1 .fighter-name b')).toHaveText(fighter.toUpperCase());
      await expect(page.locator('#match-symbol')).not.toHaveText('0:00', {timeout: 30_000});
      await page.keyboard.press('Escape');
      await page.locator('dialog#pause button[data-action="home"]').click();
      await expect(page.locator('button[data-action="training"]')).toBeVisible();
      expect(errors).toEqual([]);
    });
  }
});
