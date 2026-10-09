import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('three banks with offline logos work for expense, income and transfer without account setup', async ({
  page,
  context,
  isMobile,
}, testInfo) => {
  const tap = async (locator: ReturnType<typeof page.getByRole>) =>
    isMobile ? locator.tap() : locator.click();
  const pick = async (label: string, name: string) => {
    await tap(page.getByRole('combobox', { name: label, exact: true }));
    await tap(page.getByRole('option', { name, exact: true }));
  };
  const open = () => page.getByRole('button', { name: 'Thêm giao dịch', exact: true }).click();
  await page.goto('/');
  await open();
  const form = page.getByRole('dialog');
  await tap(form.getByRole('combobox', { name: 'Tài khoản', exact: true }));
  for (const bank of ['MB Bank', 'VietinBank', 'Sacombank']) {
    await expect(form.getByRole('option', { name: bank, exact: true })).toBeVisible();
    await expect
      .poll(() =>
        form
          .getByRole('option', { name: bank, exact: true })
          .locator('img')
          .evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0),
      )
      .toBe(true);
  }
  await page.screenshot({ path: testInfo.outputPath('bank-choices.png'), fullPage: true });
  await page.keyboard.press('Escape');
  await expect(form).toBeVisible();
  const source = form.getByRole('combobox', { name: 'Tài khoản', exact: true });
  await source.focus();
  await page.keyboard.press('Home');
  await page.keyboard.press('Enter');
  await expect(source).toContainText('MB Bank');
  await form.getByLabel('Số tiền (VND)').fill('50000');
  await form.getByLabel('Ghi chú').fill('Chi từ MB');
  await form.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(form).not.toBeVisible();
  await open();
  await form.getByRole('button', { name: 'Thu nhập', exact: true }).click();
  await pick('Tài khoản', 'VietinBank');
  await form.getByLabel('Số tiền (VND)').fill('200000');
  await form.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(form).not.toBeVisible();
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
  await open();
  await form.getByRole('button', { name: 'Chuyển tiền', exact: true }).click();
  await pick('Tài khoản chuyển', 'VietinBank');
  await tap(form.getByRole('combobox', { name: 'Tài khoản nhận', exact: true }));
  await expect(form.getByRole('option', { name: 'VietinBank', exact: true })).toBeDisabled();
  const sacom = form.getByRole('option', { name: 'Sacombank', exact: true });
  await expect
    .poll(() =>
      sacom
        .locator('img')
        .evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0),
    )
    .toBe(true);
  await tap(sacom);
  await pick('Tài khoản chuyển', 'Sacombank');
  await expect(form.getByRole('combobox', { name: 'Tài khoản nhận' })).toContainText('VietinBank');
  await pick('Tài khoản chuyển', 'VietinBank');
  await form.getByLabel('Số tiền (VND)').fill('75000');
  await form.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(form).not.toBeVisible();
  await expect(page.getByTestId('total-assets')).toContainText('150.000');
  await expect(page.getByTestId('monthly-income')).toContainText('200.000');
  await expect(page.getByTestId('monthly-expense')).toContainText('50.000');
  await page.reload();
  await page.goto('/settings');
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Xuất backup JSON', exact: true }).click();
  const file = await downloaded;
  const backup = JSON.parse(await readFile((await file.path())!, 'utf8'));
  const banks = backup.data.accounts.filter((a: { type: string }) => a.type === 'bank');
  expect(banks.map((a: { name: string }) => a.name).sort()).toEqual([
    'MB Bank',
    'Sacombank',
    'VietinBank',
  ]);
  expect(backup.data.transactions).toHaveLength(3);
  const transfer = backup.data.transactions.find((t: { type: string }) => t.type === 'transfer');
  expect(transfer.accountId).toBe(banks.find((a: { name: string }) => a.name === 'VietinBank').id);
  expect(transfer.toAccountId).toBe(banks.find((a: { name: string }) => a.name === 'Sacombank').id);
  expect(JSON.stringify(backup)).not.toContain('bank:');
});
