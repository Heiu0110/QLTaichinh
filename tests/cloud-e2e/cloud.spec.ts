import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { FakeRemoteSyncRepository } from '../FakeRemoteSyncRepository';
import { randomUUID } from 'node:crypto';
const disconnected = new WeakSet<BrowserContext>();
async function setOffline(context: BrowserContext, value: boolean) {
  if (value) disconnected.add(context);
  else disconnected.delete(context);
  await context.setOffline(value);
}
const users = [
  { id: 'fd46a766-e470-4d13-8313-1f31f9609e29', email: 'a@example.invalid' },
  { id: '8b1e44d0-a6ec-4899-b22b-42c7cc8d1a60', email: 'b@example.invalid' },
];
const jwt = (id: string) =>
  `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: id, exp: Math.floor(Date.now() / 1000) + 3600, aud: 'authenticated', role: 'authenticated' })).toString('base64url')}.synthetic-test-signature`;
async function mockCloud(context: BrowserContext, remotes: Map<string, FakeRemoteSyncRepository>) {
  await context.route('https://sotien.test/**', async (route) => {
    // Route fulfillment bypasses Chromium's offline emulation; the mock must fail too.
    if (disconnected.has(context)) return route.abort('internetdisconnected');
    const request = route.request(),
      url = new URL(request.url()),
      body = request.postDataJSON() ?? {};
    const headers = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers':
        'authorization,apikey,content-type,x-client-info,x-supabase-api-version',
      'access-control-allow-methods': 'GET,POST,PUT,OPTIONS',
    };
    const respond = (data: unknown, status = 200) =>
      route.fulfill({
        status,
        headers,
        contentType: 'application/json',
        body: JSON.stringify(data),
      });
    if (request.method() === 'OPTIONS') return respond({});
    if (url.pathname === '/auth/v1/token') {
      const user = users.find((u) => u.email === body.email) ?? users[0];
      return respond({
        access_token: jwt(user.id),
        refresh_token: `test-refresh-${user.id}`,
        expires_in: 3600,
        token_type: 'bearer',
        user: {
          ...user,
          aud: 'authenticated',
          role: 'authenticated',
          created_at: new Date().toISOString(),
        },
      });
    }
    if (url.pathname === '/auth/v1/logout' || url.pathname === '/auth/v1/recover')
      return respond({});
    const token = request.headers().authorization?.slice(7);
    let id = users[0].id;
    try {
      id = JSON.parse(Buffer.from(token!.split('.')[1], 'base64url').toString()).sub;
    } catch {}
    if (url.pathname === '/auth/v1/user') return respond(users.find((u) => u.id === id));
    const remote = remotes.get(id)!;
    try {
      if (url.pathname.endsWith('/sync_pull'))
        return respond(
          await remote.pullChanges(
            body.after_version,
            body.page_limit,
            body.upper_bound ?? undefined,
          ),
        );
      if (url.pathname.endsWith('/sync_push'))
        return respond(
          await remote.pushMutation({
            mutationId: body.mutation_id,
            entityType: body.entity_type,
            entityId: body.payload.id,
            payload: body.payload,
            baseVersion: body.base_version,
            status: 'attempted',
            localOrder: 0,
            attempts: 1,
            nextAttemptAt: 0,
          }),
        );
      if (url.pathname.endsWith('/sync_stage')) {
        await remote.stage(body.bootstrap_id, body.records);
        return respond(null);
      }
      if (url.pathname.endsWith('/sync_initialize')) {
        await remote.initialize(body.bootstrap_id, body.expected_count);
        return respond(null);
      }
      return respond({ message: 'unexpected test endpoint' }, 400);
    } catch {
      return respond({ message: 'test server error', code: '55000' }, 400);
    }
  });
}
async function login(page: Page, email = users[0].email) {
  await page.goto('/settings');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill('test-password-123');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Thiết lập sổ cloud' })).toBeVisible();
}
async function init(page: Page, action: string) {
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: action, exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Cài đặt & dữ liệu' })).toBeVisible();
}
function remotes() {
  return new Map(
    users.map((user) => {
      const remote = new FakeRemoteSyncRepository();
      remote.initialized = false;
      return [user.id, remote];
    }),
  );
}
test('authentication, legacy confirmation, two browser profiles, offline reload, logout and user isolation', async ({
  page,
  context,
  browser,
}) => {
  const servers = remotes();
  await mockCloud(context, servers);
  await login(page);
  await expect(page.getByText('Cloud chưa có sổ dữ liệu.', { exact: false })).toBeVisible();
  await init(page, 'Tải sổ local lên cloud');
  await expect(page.getByRole('button', { name: 'Nhập backup', exact: true })).toBeDisabled();
  await page.goto('/accounts');
  await page.getByRole('button', { name: 'Thêm tài khoản', exact: true }).click();
  await page.getByLabel('Tên tài khoản').fill('Private A account');
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Đồng bộ ngay', exact: true }).click();
  await expect(page.getByText('0 thay đổi chờ gửi · 0 xung đột')).toBeVisible();
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await mockCloud(phone, servers);
  const second = await phone.newPage();
  try {
    await login(second);
    await expect(second.getByText('Cloud đã có sổ dữ liệu.', { exact: false })).toBeVisible();
    await init(second, 'Dùng dữ liệu cloud');
    await second.goto('/accounts');
    await expect(second.getByText('Private A account', { exact: true })).toBeVisible();
    await second.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await second.reload();
    await setOffline(phone, true);
    await second.reload();
    await expect(second.getByText('Private A account', { exact: true })).toBeVisible();
    await second.getByRole('button', { name: 'Thêm tài khoản', exact: true }).click();
    await second.getByLabel('Tên tài khoản').fill('Offline phone');
    await second.getByRole('button', { name: 'Lưu', exact: true }).click();
    await expect(second.getByRole('dialog')).not.toBeVisible();
    await second.reload();
    await expect(second.getByText('Offline phone', { exact: true })).toBeVisible();
    await setOffline(phone, false);
    await second.goto('/settings');
    await second.getByRole('button', { name: 'Đồng bộ ngay', exact: true }).click();
    await expect(second.getByText('0 thay đổi chờ gửi · 0 xung đột')).toBeVisible();
    await page.getByRole('button', { name: 'Đồng bộ ngay', exact: true }).click();
    await page.goto('/accounts');
    await expect(page.getByText('Offline phone', { exact: true })).toBeVisible();
  } finally {
    await phone.close();
  }
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Đăng xuất trên thiết bị' }).click();
  await expect(page.getByRole('button', { name: 'Đăng nhập', exact: true })).toBeVisible();
  await page.goto('/accounts');
  await expect(page.getByText('Private A account', { exact: true })).toHaveCount(0);
  await login(page, users[1].email);
  await expect(page.getByText('Cloud chưa có sổ dữ liệu.', { exact: false })).toBeVisible();
  await init(page, 'Bắt đầu sổ cloud trống');
  await page.goto('/accounts');
  await expect(page.getByText('Private A account', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Offline phone', { exact: true })).toHaveCount(0);
});
test('conflict panel keeps both versions and requires a deliberate resolution', async ({
  page,
  context,
}, testInfo) => {
  const servers = remotes();
  await mockCloud(context, servers);
  await login(page);
  await expect(page.getByText('Cloud chưa có sổ dữ liệu.', { exact: false })).toBeVisible();
  await init(page, 'Tải sổ local lên cloud');
  const remote = servers.get(users[0].id)!;
  const cash = [...remote.records.values()].find((r) => r.entityType === 'accounts')!;
  await page.goto('/accounts');
  await setOffline(context, true);
  await page.getByRole('button', { name: 'Sửa tài khoản Tiền mặt' }).click();
  await page.getByLabel('Tên tài khoản').fill('Local desired');
  await remote.pushMutation({
    mutationId: randomUUID(),
    entityType: 'accounts',
    entityId: cash.payload.id,
    payload: { ...cash.payload, name: 'Cloud desired' },
    baseVersion: cash.version,
    status: 'attempted',
    localOrder: 0,
    attempts: 1,
    nextAttemptAt: 0,
  });
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await setOffline(context, false);
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Đồng bộ ngay', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Thay đổi cần bạn xử lý' })).toBeVisible();
  await page.locator('.conflict summary').click();
  await expect(page.getByText('Local desired', { exact: true })).toBeVisible();
  await expect(page.getByText('Cloud desired', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('conflict.png'), fullPage: true });
  await page.getByRole('button', { name: 'Giữ bản cloud', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Thay đổi cần bạn xử lý' })).not.toBeVisible();
  await page.goto('/accounts');
  await expect(page.getByText('Cloud desired', { exact: true })).toBeVisible();
});
test('unsent data survives logout, remains hidden from another user, and resumes for the owner', async ({
  page,
  context,
}, testInfo) => {
  const servers = remotes();
  await mockCloud(context, servers);
  await login(page);
  await expect(page.getByText('Cloud chưa có sổ dữ liệu.', { exact: false })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('bootstrap.png'), fullPage: true });
  await init(page, 'Tải sổ local lên cloud');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Sao lưu sổ local cũ', exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/^finance-backup-/);
  await page.goto('/accounts');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), {
          once: true,
        }),
      );
  });
  await setOffline(context, true);
  await page.getByRole('button', { name: 'Thêm tài khoản', exact: true }).click();
  await page.getByLabel('Tên tài khoản').fill('Unsent private A');
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.goto('/settings');
  await expect(page.getByText('1 thay đổi chờ gửi · 0 xung đột')).toBeVisible();
  expect(
    [...servers.get(users[0].id)!.records.values()].some(
      (r) => 'name' in r.payload && r.payload.name === 'Unsent private A',
    ),
  ).toBe(false);
  await page.getByRole('button', { name: 'Đăng xuất trên thiết bị' }).click();
  await expect(page.getByRole('button', { name: 'Đăng nhập', exact: true })).toBeVisible();
  await setOffline(context, false);
  await login(page, users[1].email);
  await expect(page.getByText('Cloud chưa có sổ dữ liệu.', { exact: false })).toBeVisible();
  await init(page, 'Bắt đầu sổ cloud trống');
  await page.goto('/accounts');
  await expect(page.getByText('Unsent private A', { exact: true })).toHaveCount(0);
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Đăng xuất trên thiết bị' }).click();
  await page.getByLabel('Email', { exact: true }).fill(users[0].email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill('test-password-123');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Đồng bộ ngay', exact: true })).toBeVisible();
  await page.goto('/accounts');
  await expect(page.getByText('Unsent private A', { exact: true })).toBeVisible();
  await expect
    .poll(() =>
      [...servers.get(users[0].id)!.records.values()].some(
        (r) => 'name' in r.payload && r.payload.name === 'Unsent private A',
      ),
    )
    .toBe(true);
});
