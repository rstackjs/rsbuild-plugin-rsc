import path from 'node:path';
import { type Build, type Dev, expect, test } from '@e2e/helper';
import type { Locator, Page } from 'playwright';

const PROJECT_DIR = path.resolve(import.meta.dirname);

const setup = async (dev: Dev, build: Build, page: Page) => {
  const rsbuild =
    process.env.TEST_MODE === 'dev'
      ? await dev({ cwd: PROJECT_DIR })
      : await build({ cwd: PROJECT_DIR, runServer: true });

  await page.goto(`http://localhost:${rsbuild.port}`);
  return rsbuild;
};

const getStyle = (locator: Locator, property: string) =>
  locator.evaluate(
    (element, styleProperty) =>
      window.getComputedStyle(element).getPropertyValue(styleProperty),
    property,
  );

test('should load root server CSS without a server entry directive', async ({
  page,
  dev,
  build,
}) => {
  await setup(dev, build, page);

  await expect(page.locator('h1')).toHaveText('Client shell');

  const panel = page.getByTestId('root-server-css-panel');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('Root server CSS');

  expect(await getStyle(panel, 'background-color')).toBe('rgb(250, 241, 211)');
  expect(await getStyle(panel, 'border-top-color')).toBe('rgb(45, 103, 90)');
  expect(await getStyle(panel, 'box-shadow')).toContain(
    'rgba(45, 103, 90, 0.3)',
  );
});
