import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Dev } from '@e2e/helper';
import type { Page } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_DIR = path.resolve(
  __dirname,
  '../../../../examples/server',
);

export const setup = async (dev: Dev, page: Page) => {
  const rsbuild = await dev({
    cwd: PROJECT_DIR,
  });
  page.goto(`http://localhost:${rsbuild.port}`);
  return rsbuild;
};
