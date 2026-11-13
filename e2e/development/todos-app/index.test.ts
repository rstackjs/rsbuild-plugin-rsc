import path from 'node:path';
import { type Dev, expect, patchFile, retry, test } from '@e2e/helper';
import type { Page } from 'playwright';

const PROJECT_DIR = path.resolve(
  import.meta.dirname,
  '../../../examples/server',
);

const setup = async (dev: Dev, page: Page) => {
  const rsbuild = await dev({
    cwd: PROJECT_DIR,
  });
  page.goto(`http://localhost:${rsbuild.port}`);
  return rsbuild;
};

test('should refetch updated Server Components and preserve unchanged server state', async ({
  page,
  dev,
}) => {
  await setup(dev, page);

  // Verify initial state
  const initialHeader = page.locator('header h1');
  await expect(initialHeader).toHaveText('Todos');

  // The actions module stores todos in memory. Reloading the entire bundle
  // would serve the new heading but lose the todo.
  const title = 'Survives a server hot update';
  await page.click('header button:has-text("+")');
  await page.fill('input[name="title"]', title);
  await page.fill('textarea[name="description"]', 'Server state');
  await page.click('dialog[open] button:has-text("Add todo")');
  const todo = page.getByRole('link', { name: title });
  await expect(todo).toBeVisible();

  // Modify the Todos.tsx file
  const todosTsxPath = path.join(PROJECT_DIR, 'src/Todos.tsx');

  await patchFile(
    todosTsxPath,
    (content) => content!.replace('<h1>Todos</h1>', '<h1>HMR Test Title</h1>'),
    async () => {
      await retry(async () => {
        const element = page.locator('header h1');
        await expect(element).toHaveText('HMR Test Title');
        await expect(todo).toBeVisible();
      });
    },
  );

  // Verify restoration after patchFile completes
  await retry(async () => {
    const element = page.locator('header h1');
    await expect(element).toHaveText('Todos');
  });
});

test('should render after adding and removing a client reference', async ({
  page,
  dev,
}) => {
  const clientFile = path.join(PROJECT_DIR, 'src/HotClient.tsx');
  await patchFile(
    clientFile,
    "'use client'; export function HotClient() { return <h1>Added client reference</h1>; }",
    async () => {
      const server = await dev({ cwd: PROJECT_DIR });
      const checkHeading = (heading: string) =>
        retry(async () => {
          const response = await page.request.get(
            `http://localhost:${server.port}`,
            {
              headers: { accept: 'text/html' },
            },
          );
          expect(response.ok()).toBe(true);
          expect(await response.text()).toContain(`<h1>${heading}</h1>`);
        });
      await checkHeading('Todos');
      await patchFile(
        path.join(PROJECT_DIR, 'src/Todos.tsx'),
        (content) =>
          content!
            .replace(
              "import './Todos.css';",
              "import './Todos.css';\nimport { HotClient } from './HotClient';",
            )
            .replace('<h1>Todos</h1>', '<HotClient />'),
        () => checkHeading('Added client reference'),
      );
      await checkHeading('Todos');
    },
  );
});

test('should preserving state when client component is modified', async ({
  page,
  dev,
}) => {
  await setup(dev, page);

  const timestamp = Date.now();
  const todoTitle = `Test Todo ${timestamp}`;
  const todoDescription = `Description for test todo ${timestamp}`;

  await page.click('header button:has-text("+")');

  const dialog = page.locator('dialog[open]');
  await expect(dialog).toBeVisible();

  await page.fill('input[name="title"]', todoTitle);
  await page.fill('textarea[name="description"]', todoDescription);

  // Modify the Dialog.tsx file
  const dialogTsxPath = path.join(PROJECT_DIR, 'src/Dialog.tsx');

  await patchFile(
    dialogTsxPath,
    (content) =>
      content!.replace(
        '<dialog ref={ref} onSubmit={() => ref.current?.close()}>',
        '<dialog ref={ref} onSubmit={() => ref.current?.close()} className="hmr-updated" data-hmr-test="true">',
      ),
    async () => {
      await retry(async () => {
        const updatedDialog = page.locator('dialog.hmr-updated');
        await expect(updatedDialog).toHaveAttribute('data-hmr-test', 'true');
      });
      // Verify form state is preserved after hot reload
      await expect(page.locator('input[name="title"]')).toHaveValue(todoTitle);
      await expect(page.locator('textarea[name="description"]')).toHaveValue(
        todoDescription,
      );
    },
  );
});

test('should serve source maps via /__rsbuild_source_map endpoint', async ({
  page,
  dev,
}) => {
  const rsbuild = await setup(dev, page);

  // Wait for the page to load
  await expect(page.locator('header h1')).toHaveText('Todos');

  // Request source map for the server bundle entry
  const response = await page.request.get(
    `http://localhost:${rsbuild.port}/__rsbuild_source_map?fileName=index.js&environmentName=Server`,
  );

  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('application/json');

  const body = await response.json();
  expect(body).toHaveProperty('version');
  expect(body).toHaveProperty('sources');
  expect(body).toHaveProperty('mappings');

  // Verify that the source map contains references to our source files
  expect(body.sources.some((source: string) => source.includes('.tsx'))).toBe(
    true,
  );
});

test('should return 404 for non-existent source map', async ({ page, dev }) => {
  const rsbuild = await setup(dev, page);

  // Wait for the page to load
  await expect(page.locator('header h1')).toHaveText('Todos');

  const response = await page.request.get(
    `http://localhost:${rsbuild.port}/__rsbuild_source_map?fileName=non-existent-file.js&environmentName=Server`,
  );

  expect(response.status()).toBe(404);
});

test('should return 400 when fileName parameter is missing', async ({
  page,
  dev,
}) => {
  const rsbuild = await setup(dev, page);

  // Wait for the page to load
  await expect(page.locator('header h1')).toHaveText('Todos');

  const response = await page.request.get(
    `http://localhost:${rsbuild.port}/__rsbuild_source_map`,
  );

  expect(response.status()).toBe(400);
});
