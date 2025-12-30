import fs from 'node:fs/promises';
import path from 'node:path';
import { expect, retry, test } from '@e2e/helper';
import { PROJECT_DIR, setup } from './setup';

const modifyFile = async (
  filePath: string,
  searchValue: string,
  replaceValue: string,
) => {
  const originalContent = await fs.readFile(filePath, 'utf-8');
  const modifiedContent = originalContent.replace(searchValue, replaceValue);
  await fs.writeFile(filePath, modifiedContent, 'utf-8');
  return originalContent;
};

const restoreFile = async (filePath: string, content: string) => {
  await fs.writeFile(filePath, content);
};

test('should refetch RSC payload when server component is modified', async ({
  page,
  dev,
}) => {
  await setup(dev, page);

  // Verify initial state
  const initialHeader = page.locator('header h1');
  await expect(initialHeader).toHaveText('Todos');

  // Modify the Todos.tsx file
  const todosTsxPath = path.join(PROJECT_DIR, 'src/Todos.tsx');
  const originalContent = await modifyFile(
    todosTsxPath,
    '<h1>Todos</h1>',
    '<h1>HMR Test Title</h1>',
  );

  try {
    await retry(async () => {
      const element = page.locator('header h1');
      await expect(element).toHaveText('HMR Test Title');
    });
  } finally {
    await restoreFile(todosTsxPath, originalContent);
    await retry(async () => {
      const element = page.locator('header h1');
      await expect(element).toHaveText('Todos');
    });
  }
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
  const originalContent = await modifyFile(
    dialogTsxPath,
    '<dialog ref={ref} onSubmit={() => ref.current?.close()}>',
    '<dialog ref={ref} onSubmit={() => ref.current?.close()} className="hmr-updated" data-hmr-test="true">',
  );

  try {
    await retry(async () => {
      const updatedDialog = page.locator('dialog.hmr-updated');
      await expect(updatedDialog).toHaveAttribute('data-hmr-test', 'true');
    });
    // Verify form state is preserved after hot reload
    await expect(page.locator('input[name="title"]')).toHaveValue(todoTitle);
    await expect(page.locator('textarea[name="description"]')).toHaveValue(
      todoDescription,
    );
  } finally {
    await restoreFile(dialogTsxPath, originalContent);
  }
});
