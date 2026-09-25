import { test, expect } from '@playwright/test';

test.describe('Finora Personal Finance E2E Suite', () => {
  test('unauthenticated users are redirected from protected routes to login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/.*login/);

    await page.goto('/transactions');
    await expect(page).toHaveURL(/.*login/);

    await page.goto('/budgets');
    await expect(page).toHaveURL(/.*login/);
  });

  test('user can log in using demo credentials and access dashboard', async ({ page }) => {
    await page.goto('/login');

    // Click demo profile button for Alex Rivera
    const demoButton = page.getByRole('button', { name: /Alex Rivera/i });
    if (await demoButton.isVisible()) {
      await demoButton.click();
    } else {
      await page.fill('input[type="email"]', 'alex@finora.test');
      await page.fill('input[type="password"]', 'Password123!');
      await page.click('button[type="submit"]');
    }

    // Verify redirected to dashboard
    await expect(page).toHaveURL(/.*dashboard/);
    await expect(page.locator('h1')).toContainText(/Financial Overview/i);
    await expect(page.getByText('Total Net Balance')).toBeVisible();
    await expect(page.getByText('Monthly Income')).toBeVisible();
    await expect(page.getByText('Monthly Expenses')).toBeVisible();
  });

  test('user can navigate to transactions and view ledger table', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('input[type="email"]', 'alex@finora.test');
    await page.fill('input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');

    // Navigate to transactions
    await page.goto('/transactions');
    await expect(page.locator('h1')).toContainText(/Transaction Ledger/i);
    await expect(page.getByRole('table')).toBeVisible();
  });

  test('user can view category budgets with progress tracking', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'alex@finora.test');
    await page.fill('input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');

    await page.goto('/budgets');
    await expect(page.locator('h1')).toContainText(/Category Budgets/i);
    await expect(page.getByText('Monthly Budget Adherence')).toBeVisible();
  });

  test('user can view financial goals and savings targets', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'alex@finora.test');
    await page.fill('input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');

    await page.goto('/goals');
    await expect(page.locator('h1')).toContainText(/Financial Savings Goals/i);
  });

  test('user can view reports and download CSV statement', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'alex@finora.test');
    await page.fill('input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');

    await page.goto('/reports');
    await expect(page.locator('h1')).toContainText(/Financial Reports/i);
    await expect(page.getByText('Download CSV')).toBeVisible();
    await expect(page.getByText('Print Statement')).toBeVisible();
  });
});
