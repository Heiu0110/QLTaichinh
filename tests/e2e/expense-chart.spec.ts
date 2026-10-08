import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
test('category pie uses expenses only, supports month changes, touch/keyboard and offline reload', async ({
  page,
  context,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const now = new Date(),
    month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousMonth = `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, '0')}`;
  const meta = () => ({
    id: randomUUID(),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    deletedAt: null,
  });
  const cash = { ...meta(), name: 'Tiền mặt', type: 'cash', currency: 'VND', initialBalance: 0 };
  const bank = { ...meta(), name: 'Ngân hàng', type: 'bank', currency: 'VND', initialBalance: 0 };
  const food = { ...meta(), name: 'Ăn uống', type: 'expense' },
    travel = { ...meta(), name: 'Di chuyển', type: 'expense' };
  const expense = (amount: number, categoryId?: string) => ({
    ...meta(),
    type: 'expense',
    amount,
    accountId: cash.id,
    date: `${month}-01`,
    ...(categoryId ? { categoryId } : {}),
  });
  const backup = {
    app: 'sotien',
    version: 1,
    exportedAt: now.toISOString(),
    data: {
      accounts: [cash, bank],
      categories: [food, travel],
      transactions: [
        expense(60000, food.id),
        expense(30000, travel.id),
        expense(10000),
        { ...expense(999000, food.id), deletedAt: now.toISOString() },
        { ...expense(120000, food.id), date: `${previousMonth}-01` },
        { ...expense(2000000), type: 'income' },
        { ...expense(80000), type: 'transfer', toAccountId: bank.id },
      ],
      budgets: [],
      savingsGoals: [],
      settings: [],
    },
  };
  await page.goto('/settings');
  await page
    .getByLabel('Chọn file backup')
    .setInputFiles({
      name: 'chart-fixture.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(backup)),
    });
  await page.getByRole('dialog').getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Thay thế dữ liệu', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.goto('/');
  const chart = page.getByTestId('expense-pie');
  await expect(chart.getByRole('img')).toHaveAttribute('aria-label', /tổng 100\.000/);
  await expect(chart.locator('svg path')).toHaveCount(3);
  await expect(chart.getByRole('button', { name: /Ăn uống/ })).toContainText('60%');
  await expect(chart.getByRole('button', { name: /Di chuyển/ })).toContainText('30%');
  await expect(chart.getByRole('button', { name: /Chưa phân loại/ })).toContainText('10%');
  const foodButton = chart.getByRole('button', { name: /Ăn uống/ });
  await foodButton.click();
  await expect(foodButton).toHaveAttribute('aria-pressed', 'true');
  await expect(chart.locator('[aria-live="polite"]')).toContainText('60.000');
  await foodButton.focus();
  await page.keyboard.press('Enter');
  await expect(foodButton).toHaveAttribute('aria-pressed', 'false');
  await page.goto('/reports');
  await expect(chart.getByRole('img')).toHaveAttribute('aria-label', /tổng 100\.000/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('expense-pie.png'), fullPage: true });
  await page.getByLabel('Tháng báo cáo').fill(previousMonth);
  await expect(chart.locator('svg circle')).toHaveCount(1);
  await expect(chart.getByRole('button', { name: /Ăn uống/ })).toContainText('100%');
  await expect(chart.getByRole('img')).toHaveAttribute('aria-label', /tổng 120\.000/);
  await page.getByLabel('Tháng báo cáo').fill('1900-06');
  await expect(page.getByText('Chưa có chi tiêu trong tháng', { exact: true })).toBeVisible();
  await expect(chart).toHaveCount(0);
  await page.getByLabel('Tháng báo cáo').fill(month);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), {
          once: true,
        }),
      );
  });
  await context.setOffline(true);
  await page.reload();
  await expect(chart.getByRole('img')).toHaveAttribute('aria-label', /tổng 100\.000/);
  await chart.getByRole('button', { name: /Di chuyển/ }).click();
  await expect(chart.locator('[aria-live="polite"]')).toContainText('30.000');
  expect(errors).toEqual([]);
});
