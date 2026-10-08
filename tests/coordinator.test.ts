import { afterEach, expect, test, vi } from 'vitest';
import { SyncCoordinator } from '../src/sync/SyncCoordinator';
import { SyncEngine } from '../src/sync/SyncEngine';
import { SyncError } from '../src/sync/syncTypes';
const coordinators: SyncCoordinator[] = [];
afterEach(() => {
  for (const c of coordinators.splice(0)) c.stop();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
function setup(work = vi.fn(async () => undefined)) {
  vi.useFakeTimers();
  vi.stubGlobal('navigator', { onLine: true });
  const win = new EventTarget(),
    doc = new EventTarget();
  Object.assign(doc, { visibilityState: 'visible' });
  vi.stubGlobal('window', win);
  vi.stubGlobal('document', doc);
  const engine = {
    db: {
      name: 'fixture',
      syncQueue: { toArray: async () => [] },
      syncState: { get: async () => ({ value: 'true' }) },
    },
    sync: work,
  } as unknown as SyncEngine;
  const coordinator = new SyncCoordinator(engine);
  coordinators.push(coordinator);
  return { coordinator, work, win, doc };
}
test('network retries are bounded and manual sync resumes after the retry budget is exhausted', async () => {
  const work = vi.fn(async () => {
    throw new SyncError('network', 'offline');
  });
  const { coordinator } = setup(work);
  coordinator.start(true);
  await vi.advanceTimersByTimeAsync(120000);
  expect(work).toHaveBeenCalledTimes(6);
  expect(coordinator.getSnapshot().running).toBe(false);
  coordinator.request(true);
  await vi.advanceTimersByTimeAsync(1);
  expect(work).toHaveBeenCalledTimes(7);
});
test('authentication failures pause retries and a restored session restarts the coordinator', async () => {
  const work = vi.fn(async () => {
    throw new SyncError('auth', 'sign in');
  });
  const { coordinator } = setup(work);
  coordinator.start(true);
  await vi.advanceTimersByTimeAsync(120000);
  expect(work).toHaveBeenCalledTimes(1);
  expect(coordinator.getSnapshot().authorized).toBe(false);
  work.mockResolvedValue(undefined);
  coordinator.start(true);
  await vi.advanceTimersByTimeAsync(1);
  expect(work).toHaveBeenCalledTimes(2);
  expect(coordinator.getSnapshot().error).toBe('');
});
test('foreground checks actual connectivity, and logout aborts in-flight work without applying late state', async () => {
  let captured: AbortSignal | undefined;
  let finish!: () => void;
  const work = vi.fn((signal?: AbortSignal) => {
    captured = signal;
    return new Promise<void>((r) => {
      finish = r;
    });
  });
  const { coordinator, doc } = setup(work);
  vi.stubGlobal('navigator', { onLine: false });
  coordinator.start(true);
  doc.dispatchEvent(new Event('visibilitychange'));
  await vi.advanceTimersByTimeAsync(1);
  expect(work).not.toHaveBeenCalled();
  vi.stubGlobal('navigator', { onLine: true });
  doc.dispatchEvent(new Event('visibilitychange'));
  await vi.advanceTimersByTimeAsync(1);
  expect(work).toHaveBeenCalledTimes(1);
  coordinator.stop();
  expect(captured?.aborted).toBe(true);
  finish();
  await vi.advanceTimersByTimeAsync(100000);
  expect(work).toHaveBeenCalledTimes(1);
});
