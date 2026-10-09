import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('transfer account selection recovers from one account and preserves the draft when adding another', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Thêm giao dịch', exact: true }).click();
  const form = page.getByRole('dialog');
  await form.getByLabel('Số tiền (VND)').fill('125000');
  await form.getByLabel('Ghi chú').fill('Chuyển tiền thử nghiệm');
  await form.getByLabel('Danh mục', { exact: true }).selectOption({ label: 'Ăn uống' });
  const cash = await form.getByLabel('Tài khoản', { exact: true }).inputValue();
  expect(cash).not.toBe('');
  await form.getByRole('button', { name: 'Chuyển tiền', exact: true }).click();
  await expect(form.getByRole('status')).toContainText('ít nhất hai tài khoản');
  await expect(form.getByLabel('Tài khoản chuyển')).toHaveValue(cash);
  await expect(form.getByLabel('Tài khoản nhận')).toHaveValue('');
  await expect(form.getByLabel('Tài khoản nhận').locator(`option[value="${cash}"]`)).toBeDisabled();
  await expect(form.getByRole('button', { name: 'Lưu', exact: true })).toBeDisabled();

  // Cancelling account creation must not discard the transaction draft.
  await form.getByRole('button', { name: 'Thêm tài khoản mới' }).click();
  await form.getByRole('button', { name: 'Hủy', exact: true }).click();
  await expect(form.getByLabel('Số tiền (VND)')).toHaveValue('125000');
  await expect(form.getByLabel('Ghi chú')).toHaveValue('Chuyển tiền thử nghiệm');
  await form.getByRole('button', { name: 'Thêm tài khoản mới' }).click();
  await form.getByLabel('Tên tài khoản').fill('Ngân hàng chuyển tiền');
  await form.getByLabel('Loại tài khoản').selectOption('bank');
  await form.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(form.getByLabel('Tài khoản nhận').locator('option:checked')).toHaveText(
    'Ngân hàng chuyển tiền',
  );
  const bank = await form.getByLabel('Tài khoản nhận').inputValue();
  expect(bank).not.toBe(cash);
  await expect(form.getByLabel('Số tiền (VND)')).toHaveValue('125000');

  // Choosing the destination as the new source swaps the pair instead of clearing it.
  await form.getByLabel('Tài khoản chuyển').selectOption(bank);
  await expect(form.getByLabel('Tài khoản nhận')).toHaveValue(cash);
  await form.getByRole('button', { name: 'Thu nhập', exact: true }).click();
  await expect(form.getByLabel('Danh mục', { exact: true })).toHaveValue('');
  await form.getByRole('button', { name: 'Chi tiêu', exact: true }).click();
  await form.getByLabel('Danh mục', { exact: true }).selectOption({ label: 'Ăn uống' });
  await form.getByRole('button', { name: 'Chuyển tiền', exact: true }).click();
  await expect(form.getByLabel('Tài khoản chuyển')).toHaveValue(bank);
  await expect(form.getByLabel('Tài khoản nhận')).toHaveValue(cash);
  await form.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(form).not.toBeVisible();
  await expect(page.getByTestId('total-assets')).toHaveText(/0\s*₫/);
  await expect(page.getByTestId('monthly-income')).toHaveText(/0\s*₫/);
  await expect(page.getByTestId('monthly-expense')).toHaveText(/0\s*₫/);
  await page.reload();
  await page.goto('/settings');
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Xuất backup JSON', exact: true }).click();
  const file = await downloaded;
  const backup = JSON.parse(await readFile((await file.path())!, 'utf8'));
  expect(backup.data.accounts).toHaveLength(2);
  expect(backup.data.transactions).toHaveLength(1);
  expect(backup.data.transactions[0]).toMatchObject({
    type: 'transfer',
    amount: 125000,
    accountId: bank,
    toAccountId: cash,
    note: 'Chuyển tiền thử nghiệm',
  });
  expect(backup.data.transactions[0].categoryId).toBeUndefined();
});
