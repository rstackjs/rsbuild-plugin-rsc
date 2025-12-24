import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';

test.describe('Server Example - Todo App', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app before each test
    await page.goto(BASE_URL);
  });

  test('should load the page and display the title', async ({ page }) => {
    // Check page title
    await expect(page).toHaveTitle('Todos');

    // Check header is visible
    const header = page.locator('header h1');
    await expect(header).toBeVisible();
    await expect(header).toHaveText('Todos');

    // Check "Add todo" button is visible
    const addButton = page.locator('header button', { hasText: '+' });
    await expect(addButton).toBeVisible();
  });

  test('should display todo list', async ({ page }) => {
    // Wait for the todo list to be visible
    const todoList = page.locator('.todo-column ul');
    await expect(todoList).toBeVisible();

    // Check if there are any todo items (may be empty initially)
    const todoItems = page.locator('.todo-column ul li');
    const count = await todoItems.count();

    // If there are todos, verify their structure
    if (count > 0) {
      const firstTodo = todoItems.first();
      await expect(firstTodo.locator('input[type="checkbox"]')).toBeVisible();
      await expect(firstTodo.locator('a')).toBeVisible();
      await expect(firstTodo.locator('button', { hasText: 'x' })).toBeVisible();
    }
  });

  test('should create a new todo', async ({ page }) => {
    // Click the "Add todo" button
    await page.click('header button:has-text("+")');

    // Wait for the dialog to appear
    const dialog = page.locator('dialog[open]');
    await expect(dialog).toBeVisible();

    // Fill in the form
    const timestamp = Date.now();
    const todoTitle = `Test Todo ${timestamp}`;
    const todoDescription = `Description for test todo ${timestamp}`;

    await page.fill('input[name="title"]', todoTitle);
    await page.fill('textarea[name="description"]', todoDescription);
    await page.fill('input[name="dueDate"]', '2025-12-31');

    // Submit the form (button doesn't have type="submit" in TodoCreate)
    await page.click('dialog[open] button:has-text("Add todo")');

    // Wait for the dialog to close
    await expect(dialog).not.toBeVisible();

    // Verify the new todo appears in the list
    const newTodo = page.locator('.todo-column ul li a', { hasText: todoTitle });
    await expect(newTodo).toBeVisible();
  });

  test('should mark a todo as complete and incomplete', async ({ page }) => {
    // First, ensure there's at least one todo
    const todoItems = page.locator('.todo-column ul li');
    const count = await todoItems.count();

    if (count === 0) {
      // Create a todo first
      await page.click('header button:has-text("+")');
      await page.fill('input[name="title"]', 'Test Complete Todo');
      await page.fill('textarea[name="description"]', 'Test description');
      await page.click('dialog[open] button:has-text("Add todo")');
      await page.waitForTimeout(500);
    }

    // Get the first todo item
    const firstTodo = page.locator('.todo-column ul li').first();
    const checkbox = firstTodo.locator('input[type="checkbox"]');

    // Get initial state
    const initialChecked = await checkbox.isChecked();

    // Toggle the checkbox
    await checkbox.click();

    // Wait for the state to update
    await page.waitForTimeout(500);

    // Verify the state changed
    await expect(checkbox).toBeChecked({ checked: !initialChecked });

    // Toggle back
    await checkbox.click();
    await page.waitForTimeout(500);

    // Verify it's back to the original state
    await expect(checkbox).toBeChecked({ checked: initialChecked });
  });

  test('should delete a todo', async ({ page }) => {
    // First, create a todo to delete
    await page.click('header button:has-text("+")');
    const timestamp = Date.now();
    const todoTitle = `Delete Me ${timestamp}`;

    await page.fill('input[name="title"]', todoTitle);
    await page.fill('textarea[name="description"]', 'This will be deleted');
    await page.click('dialog[open] button:has-text("Add todo")');

    // Wait for the todo to appear
    const todoToDelete = page.locator('.todo-column ul li a', { hasText: todoTitle });
    await expect(todoToDelete).toBeVisible();

    // Find the delete button for this todo
    const todoItem = page.locator('.todo-column ul li', { has: page.locator('a', { hasText: todoTitle }) });
    const deleteButton = todoItem.locator('button:has-text("x")');

    // Click delete
    await deleteButton.click();

    // Wait for the todo to be removed
    await page.waitForTimeout(500);

    // Verify the todo is no longer in the list
    await expect(todoToDelete).not.toBeVisible();
  });

  test('should navigate to todo detail page', async ({ page }) => {
    // Ensure there's at least one todo
    const todoItems = page.locator('.todo-column ul li');
    const count = await todoItems.count();

    if (count === 0) {
      // Create a todo first
      await page.click('header button:has-text("+")');
      await page.fill('input[name="title"]', 'Detail Test Todo');
      await page.fill('textarea[name="description"]', 'Test description for details');
      await page.click('dialog[open] button:has-text("Add todo")');
      await page.waitForTimeout(500);
    }

    // Click on the first todo link
    const firstTodoLink = page.locator('.todo-column ul li a').first();
    const todoTitle = await firstTodoLink.textContent();
    await firstTodoLink.click();

    // Wait for navigation
    await page.waitForTimeout(500);

    // Verify the URL changed
    expect(page.url()).toMatch(/\/todos\/\d+/);

    // Verify the todo item is marked as selected
    const selectedTodo = page.locator('.todo-column ul li[data-selected]');
    await expect(selectedTodo).toBeVisible();

    // Verify the detail view is shown (not the "Select a todo" message)
    const selectMessage = page.locator('main p:has-text("Select a todo")');
    await expect(selectMessage).not.toBeVisible();

    // Verify detail content is visible (the form with class "todo")
    const detailForm = page.locator('form.todo');
    await expect(detailForm).toBeVisible();
  });

  test('should update a todo from detail page', async ({ page }) => {
    // Create a todo to update
    await page.click('header button:has-text("+")');
    const timestamp = Date.now();
    const originalTitle = `Update Test ${timestamp}`;

    await page.fill('input[name="title"]', originalTitle);
    await page.fill('textarea[name="description"]', 'Original description');
    await page.fill('input[name="dueDate"]', '2025-12-25');
    await page.click('dialog[open] button:has-text("Add todo")');

    // Wait and click on the todo to view details
    await page.waitForTimeout(500);
    const todoLink = page.locator('.todo-column ul li a', { hasText: originalTitle });
    await todoLink.click();
    await page.waitForTimeout(500);

    // Find and fill the update form in the detail view
    const detailForm = page.locator('form.todo');
    const updatedTitle = `Updated ${timestamp}`;
    const updatedDescription = 'Updated description';

    await detailForm.locator('input[name="title"]').fill(updatedTitle);
    await detailForm.locator('textarea[name="description"]').fill(updatedDescription);
    await detailForm.locator('input[name="dueDate"]').fill('2025-12-31');

    // Submit the update form
    await detailForm.locator('button[type="submit"]').click();

    // Wait for the update to complete
    await page.waitForTimeout(500);

    // Verify the todo title is updated in the list
    const updatedTodoLink = page.locator('.todo-column ul li a', { hasText: updatedTitle });
    await expect(updatedTodoLink).toBeVisible();

    // Verify the old title is no longer present
    const oldTodoLink = page.locator('.todo-column ul li a', { hasText: originalTitle });
    await expect(oldTodoLink).not.toBeVisible();
  });

  test('should handle client-side navigation', async ({ page }) => {
    // Ensure there are at least 2 todos
    const todoItems = page.locator('.todo-column ul li');
    let count = await todoItems.count();

    while (count < 2) {
      await page.click('header button:has-text("+")');
      await page.fill('input[name="title"]', `Nav Test Todo ${count + 1}`);
      await page.fill('textarea[name="description"]', 'Description');
      await page.click('dialog[open] button:has-text("Add todo")');
      await page.waitForTimeout(500);
      count = await todoItems.count();
    }

    // Click on the first todo
    const firstTodoLink = page.locator('.todo-column ul li a').first();
    await firstTodoLink.click();
    await page.waitForTimeout(500);

    const firstUrl = page.url();
    expect(firstUrl).toMatch(/\/todos\/\d+/);

    // Click on the second todo
    const secondTodoLink = page.locator('.todo-column ul li a').nth(1);
    await secondTodoLink.click();
    await page.waitForTimeout(500);

    const secondUrl = page.url();
    expect(secondUrl).toMatch(/\/todos\/\d+/);
    expect(secondUrl).not.toBe(firstUrl);

    // Use browser back button
    await page.goBack();
    await page.waitForTimeout(500);

    expect(page.url()).toBe(firstUrl);

    // Use browser forward button
    await page.goForward();
    await page.waitForTimeout(500);

    expect(page.url()).toBe(secondUrl);
  });

  test('should show "Select a todo" message when no todo is selected', async ({ page }) => {
    // Navigate to the root URL
    await page.goto(BASE_URL);

    // Verify the "Select a todo" message is visible
    const selectMessage = page.locator('main p:has-text("Select a todo")');
    await expect(selectMessage).toBeVisible();
  });

  test('should close dialog after form submission', async ({ page }) => {
    // Open the dialog
    await page.click('header button:has-text("+")');

    const dialog = page.locator('dialog[open]');
    await expect(dialog).toBeVisible();

    // Fill and submit the form
    await page.fill('input[name="title"]', 'Dialog Close Test');
    await page.fill('textarea[name="description"]', 'Testing dialog close');
    await page.click('dialog[open] button:has-text("Add todo")');

    // Wait for the dialog to close
    await page.waitForTimeout(500);

    // Verify the dialog is closed
    await expect(dialog).not.toBeVisible();
  });
});
