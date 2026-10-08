import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const date = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
async function addTransaction(
  page: Page,
  type: 'Thu nhập' | 'Chi tiêu',
  amount: string,
  note: string,
) {
  await page.getByRole('button', { name: 'Thêm giao dịch', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: type, exact: true }).click();
  await dialog.getByLabel('Số tiền (VND)').fill(amount);
  await dialog.getByLabel('Ghi chú').fill(note);
  if (type === 'Chi tiêu') await dialog.getByLabel('Danh mục').selectOption({ label: 'Ăn uống' });
  await dialog.getByLabel('Ngày giao dịch').fill(date());
  await dialog.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(dialog).not.toBeVisible();
}
test('real finance flow: CRUD, filters, budgets, backup, restore and persistent reload', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('dialog', (dialog) => void dialog.accept());
  await page.goto('/');
  await expect(page.getByTestId('total-assets')).toContainText('0');
  await addTransaction(page, 'Thu nhập', '10000000', 'Lương tháng này');
  await addTransaction(page, 'Chi tiêu', '35000', 'Cà phê sáng');
  await expect(page.getByTestId('total-assets')).toContainText('9.965.000');
  await expect(page.getByTestId('monthly-income')).toContainText('10.000.000');
  await page.reload();
  await expect(page.getByTestId('total-assets')).toContainText('9.965.000');
  await page.goto('/transactions');
  await expect(page.getByTestId('transaction-row')).toHaveCount(2);
  await page.getByLabel('Tìm ghi chú').fill('cà phê');
  await expect(page.getByTestId('transaction-row')).toHaveCount(1);
  await page.getByRole('button', { name: 'Sửa giao dịch Cà phê sáng' }).click();
  await page.getByRole('dialog').getByLabel('Số tiền (VND)').fill('45000');
  await page.getByRole('dialog').getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByTestId('transaction-row')).toContainText('45.000');
  await page.getByRole('button', { name: 'Bộ lọc' }).click();
  await page.getByLabel('Loại', { exact: true }).selectOption('income');
  await expect(page.getByTestId('transaction-row')).toHaveCount(0);
  await page.getByRole('button', { name: 'Xóa bộ lọc' }).click();
  await expect(page.getByTestId('transaction-row')).toHaveCount(2);
  await page.goto('/budgets');
  await page.getByRole('button', { name: 'Thêm ngân sách' }).click();
  await page
    .getByRole('dialog')
    .getByLabel('Danh mục ngân sách')
    .selectOption({ label: 'Ăn uống' });
  await page.getByRole('dialog').getByLabel('Hạn mức (VND)').fill('100000');
  await page.getByRole('dialog').getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(page.getByRole('progressbar', { name: 'Ngân sách Ăn uống' })).toHaveAttribute(
    'aria-valuenow',
    '45',
  );
  await page.goto('/accounts');
  await page.getByRole('button', { name: 'Thêm tài khoản' }).click();
  await page.getByRole('dialog').getByLabel('Tên tài khoản').fill('Ngân hàng cá nhân');
  await page.getByRole('dialog').getByLabel('Loại tài khoản').selectOption('bank');
  await page.getByRole('dialog').getByLabel('Số dư ban đầu (VND)').fill('1000000');
  await page.getByRole('dialog').getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ngân hàng cá nhân' })).toBeVisible();
  await page.goto('/savings');
  await page.getByRole('button', { name: 'Thêm mục tiêu' }).click();
  await page.getByRole('dialog').getByLabel('Tên mục tiêu').fill('Quỹ dự phòng');
  await page.getByRole('dialog').getByLabel('Số tiền mục tiêu (VND)').fill('20000000');
  await page.getByRole('dialog').getByLabel('Số tiền hiện tại (VND)').fill('0');
  await page.getByRole('dialog').getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Quỹ dự phòng' })).toBeVisible();
  await page.goto('/categories');
  await page.getByRole('button', { name: 'Thêm danh mục' }).click();
  await page.getByRole('dialog').getByLabel('Tên danh mục').fill('Thú cưng');
  await page.getByRole('dialog').getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(page.getByText('Thú cưng', { exact: true })).toBeVisible();
  await page.goto('/settings');
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Xuất backup JSON' }).click();
  const file = await downloaded;
  expect(file.suggestedFilename()).toBe(`finance-backup-${date()}.json`);
  const path = await file.path();
  const exported = await readFile(path!, 'utf8');
  const parsed = JSON.parse(exported);
  expect(parsed.data.transactions).toHaveLength(2);
  expect(parsed.data.budgets).toHaveLength(1);
  await page.goto('/transactions');
  await page.getByRole('button', { name: 'Xóa giao dịch Cà phê sáng' }).click();
  await expect(page.getByTestId('transaction-row')).toHaveCount(1);
  await page.goto('/settings');
  await page
    .getByLabel('Chọn file backup')
    .setInputFiles({
      name: 'backup.json',
      mimeType: 'application/json',
      buffer: Buffer.from(exported),
    });
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(
    page.getByRole('dialog').getByRole('button', { name: 'Thay thế dữ liệu' }),
  ).toBeDisabled();
  await page.getByRole('dialog').getByRole('checkbox').check();
  await page.getByRole('dialog').getByRole('button', { name: 'Thay thế dữ liệu' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.goto('/');
  await expect(page.getByTestId('total-assets')).toContainText('10.955.000');
  await page.screenshot({ path: testInfo.outputPath('dashboard.png'), fullPage: true });
  expect(errors).toEqual([]);
});
test('PWA manifest and cached application survive offline reload and navigation', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await expect(page.getByTestId('total-assets')).toBeVisible();
  await addTransaction(page, 'Chi tiêu', '25000', 'Offline test');
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), {
          once: true,
        }),
      );
    return !!reg.active;
  });
  const manifest = await (await page.request.get('/manifest.webmanifest')).json();
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons).toHaveLength(3);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId('total-assets')).toContainText('25.000');
  await page.goto('/transactions');
  await expect(page.getByTestId('transaction-row')).toContainText('Offline test');
  await addTransaction(page, 'Chi tiêu', '15000', 'Ghi khi mất mạng');
  await page.reload();
  await expect(page.getByTestId('transaction-row')).toHaveCount(2);
  await expect(page.getByText('Ghi khi mất mạng', { exact: true })).toBeVisible();
  await page.goto('/settings');
  await expect(page.getByText('Đã lưu ứng dụng để dùng offline')).toBeVisible();
});
test('mobile sizes, forms and all screens fit without page overflow', async ({
  page,
}, testInfo) => {
  await page.goto('/');
  await expect(page.getByTestId('total-assets')).toBeVisible();
  for (const width of [375, 390, 430, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of [
      '/',
      '/transactions',
      '/accounts',
      '/categories',
      '/budgets',
      '/savings',
      '/reports',
      '/settings',
    ]) {
      await page.goto(route);
      await expect(page.locator('h1')).toBeVisible();
      const fits = await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      );
      expect(fits, `${route} at ${width}px`).toBe(true);
    }
  }
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Thêm giao dịch nhanh' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Số tiền (VND)').fill('0');
  await dialog.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(dialog.getByRole('alert')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('mobile-form.png'), fullPage: true });
  await dialog.getByRole('button', { name: 'Hủy', exact: true }).click();
  await expect(dialog).not.toBeVisible();
});
