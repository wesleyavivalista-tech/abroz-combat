import {test, expect} from '@playwright/test';
import {openGame, watchErrors} from './helpers.js';

test('launch chooser links to the browser game and the download page', async ({page}) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await expect(page.locator('a.primary[href="/play"]')).toBeVisible();
  await expect(page.locator('a[href="/download"]')).toBeVisible();
  await page.click('a[href="/download"]');
  await expect(page).toHaveURL(/\/download/);
  await expect(page.locator('body')).not.toBeEmpty();
  expect(errors).toEqual([]);
});

test('game home renders every mode entry without startup errors', async ({page}) => {
  const errors = watchErrors(page);
  await openGame(page);
  for (const action of ['local', 'online', 'training', 'characters']) {
    await expect(page.locator(`button[data-action="${action}"]`)).toBeVisible();
  }
  await page.click('button[data-action="local"]');
  for (const action of ['local-versus', 'local-ffa', 'local-2v2', 'local-3v3', 'championship', 'elimination', 'elimination-party']) {
    await expect(page.locator(`button[data-action="${action}"]`)).toBeVisible();
  }
  await page.click('button[data-action="home"]');
  await expect(page.locator('button[data-action="training"]')).toBeVisible();
  expect(errors).toEqual([]);
});

test('fighter guide lists the whole roster', async ({page}) => {
  const errors = watchErrors(page);
  await openGame(page);
  await page.click('button[data-action="characters"]');
  await expect(page.locator('button[data-action="pick"]')).toHaveCount(16);
  await page.click('button[data-action="pick"][data-id="roms"]');
  await expect(page.locator('button[data-action="pick"][data-id="roms"]')).toHaveAttribute('aria-pressed', 'true');
  expect(errors).toEqual([]);
});

test('a saved Portuguese preference localizes the home screen', async ({page}) => {
  await page.addInitScript(() => {
    try { localStorage.setItem('abroz-language', 'pt-BR'); } catch { /* Defaults still render. */ }
  });
  await page.goto('/play');
  await expect(page.locator('button[data-action="training"]')).toContainText('TREINO');
});
