import { liveQuery } from 'dexie';
import { SyncEngine } from './SyncEngine';
import { SyncError } from './syncTypes';
export interface SyncStatus {
  running: boolean;
  online: boolean;
  authorized: boolean;
  error: string;
  errorKind?: string;
}
export class SyncCoordinator {
  private state: SyncStatus = {
    running: false,
    online: typeof navigator === 'undefined' || navigator.onLine,
    authorized: false,
    error: '',
  };
  private listeners = new Set<() => void>();
  private timer?: ReturnType<typeof setTimeout>;
  private stopController?: AbortController;
  private unsubscribe?: () => void;
  private running = false;
  private dirty = false;
  private retries = 0;
  private stopped = true;
  constructor(readonly engine: SyncEngine) {}
  getSnapshot = () => this.state;
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  private publish(values: Partial<SyncStatus>) {
    this.state = { ...this.state, ...values };
    this.listeners.forEach((fn) => fn());
  }
  private onOnline = () => {
    this.publish({ online: navigator.onLine });
    if (navigator.onLine) this.request(true);
  };
  private onVisible = () => {
    if (document.visibilityState === 'visible') {
      this.publish({ online: navigator.onLine });
      this.request(true);
    }
  };
  start(authorized: boolean) {
    this.stop();
    this.stopped = false;
    this.stopController = new AbortController();
    this.publish({ authorized, running: false });
    let previous = '';
    const subscription = liveQuery(() => this.engine.db.syncQueue.toArray()).subscribe((rows) => {
      const signature = rows
        .filter((r) => r.status === 'pending')
        .map((r) => `${r.mutationId}:${r.payload.updatedAt}:${r.payload.deletedAt}`)
        .join('|');
      if (signature && signature !== previous) this.request();
      previous = signature;
    });
    this.unsubscribe = () => subscription.unsubscribe();
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.onOnline);
      window.addEventListener('offline', this.onOnline);
      document.addEventListener('visibilitychange', this.onVisible);
    }
    this.request(true);
  }
  stop() {
    this.stopped = true;
    clearTimeout(this.timer);
    this.stopController?.abort();
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.onOnline);
      window.removeEventListener('offline', this.onOnline);
      document.removeEventListener('visibilitychange', this.onVisible);
    }
  }
  request(immediate = false) {
    if (this.stopped || !this.state.authorized) return;
    if (this.running) {
      this.dirty = true;
      return;
    }
    clearTimeout(this.timer);
    if (immediate) this.retries = 0;
    this.timer = setTimeout(() => void this.run(), immediate ? 0 : 500);
  }
  private async run() {
    if (this.stopped || this.running || !this.state.authorized || !this.state.online) return;
    const signal = this.stopController!.signal;
    this.running = true;
    this.dirty = false;
    this.publish({ running: true, error: '', errorKind: undefined });
    let succeeded = false;
    try {
      const work = async () => {
        if ((await this.engine.db.syncState.get('ready'))?.value === 'true')
          await this.engine.sync(signal);
      };
      if (typeof navigator !== 'undefined' && navigator.locks)
        await navigator.locks.request(`sotien-sync:${this.engine.db.name}`, { signal }, work);
      else await work();
      succeeded = true;
      this.retries = 0;
    } catch (error) {
      if (!signal.aborted) {
        const kind = error instanceof SyncError ? error.kind : 'server';
        this.publish({
          error:
            error instanceof SyncError
              ? error.message
              : 'Chưa đồng bộ được. Dữ liệu local và hàng đợi vẫn được giữ.',
          errorKind: kind,
          ...(kind === 'auth' ? { authorized: false } : {}),
        });
        if ((kind === 'network' || kind === 'server') && this.retries < 5) {
          const delay = Math.min(60000, 2000 * 2 ** this.retries++);
          this.timer = setTimeout(() => void this.run(), delay);
        }
      }
    } finally {
      this.running = false;
      if (!signal.aborted) this.publish({ running: false });
      if (!this.stopped && signal !== this.stopController?.signal) this.request(true);
      else if (succeeded && this.dirty && !this.stopped) this.request();
    }
  }
}
