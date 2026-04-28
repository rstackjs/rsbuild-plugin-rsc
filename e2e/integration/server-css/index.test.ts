import path from 'node:path';
import { type Build, type Dev, expect, test } from '@e2e/helper';
import type { Page } from 'playwright';

const PROJECT_DIR = path.resolve(import.meta.dirname);
const pageStyleAssertions = [
  {
    testId: 'server-css-page-one',
    properties: [
      ['background-color', 'rgb(230, 244, 255)'],
      ['border-top-color', 'rgb(70, 130, 180)'],
    ],
  },
  {
    testId: 'server-css-page-two',
    properties: [
      ['background-color', 'rgb(255, 240, 230)'],
      ['border-top-color', 'rgb(220, 20, 60)'],
    ],
  },
] as const;
const childStyleAssertions = [
  ['.page-one-child-css', 'color', 'rgb(0, 104, 155)'],
  ['.page-two-child-css', 'color', 'rgb(180, 90, 0)'],
] as const;
const minimumStylesheetCount = 4;
const rootCssMarkers = ['server-css-root'] as const;
const pageCssMarkers = [
  'page-one-css',
  'page-one-child-css',
  'page-two-css',
  'page-two-child-css',
] as const;

type CssAsset = [file: string, source: string];

const getCssAssets = (distFiles: Record<string, string>) =>
  Object.entries(distFiles).filter(([file]) => file.endsWith('.css'));

const findCssAsset = (assets: CssAsset[], marker: string) => {
  const asset = assets.find(([, source]) => source.includes(marker));
  if (!asset) {
    throw new Error(`Expected a CSS asset containing "${marker}"`);
  }
  return asset;
};

const startApp = async (dev: Dev, build: Build, page: Page) => {
  const rsbuild =
    process.env.TEST_MODE === 'dev'
      ? await dev({ cwd: PROJECT_DIR })
      : await build({ cwd: PROJECT_DIR, runServer: true });

  await page.goto(`http://localhost:${rsbuild.port}`);
  return rsbuild;
};

test('should split root CSS and server-entry page CSS', async ({
  page,
  dev,
  build,
}) => {
  const rsbuild = await startApp(dev, build, page);

  await expect(
    page.getByRole('heading', { name: 'Client shell' }),
  ).toBeVisible();

  await expect(
    page.getByRole('heading', { name: 'Server CSS root' }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Page 1' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Page 2' })).toBeVisible();

  expect(
    await page.locator('link[rel="stylesheet"]').count(),
  ).toBeGreaterThanOrEqual(minimumStylesheetCount);

  const cssAssets = getCssAssets(rsbuild.getDistFiles());
  const [rootCssFile, rootCss] = findCssAsset(cssAssets, rootCssMarkers[0]);
  for (const marker of rootCssMarkers) {
    expect(rootCss).toContain(marker);
  }
  for (const marker of pageCssMarkers) {
    expect(rootCss).not.toContain(marker);
  }

  for (const marker of pageCssMarkers) {
    const [file, source] = findCssAsset(cssAssets, marker);
    expect(file).not.toBe(rootCssFile);
    expect(source).toContain(marker);
  }

  for (const { testId, properties } of pageStyleAssertions) {
    const target = page.getByTestId(testId);
    await expect(target).toBeVisible();
    for (const [property, value] of properties) {
      await expect(target).toHaveCSS(property, value);
    }
  }

  for (const [selector, property, value] of childStyleAssertions) {
    await expect(page.locator(selector)).toHaveCSS(property, value);
  }
});
