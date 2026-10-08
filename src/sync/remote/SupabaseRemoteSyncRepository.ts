import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { RemoteSyncRepository } from './RemoteSyncRepository';
import {
  entityTypes,
  schemas,
  versionSchema,
  SyncError,
  type Mutation,
  type PullPage,
  type PushResult,
  type EntityType,
  type DomainRecord,
} from '../syncTypes';
const envelope = z
  .object({
    entityType: z.enum(entityTypes),
    payload: z.unknown(),
    version: versionSchema,
    mutationId: z.uuid(),
  })
  .strict();
const pageSchema = z
  .object({
    initialized: z.boolean(),
    upperBound: versionSchema,
    cursor: versionSchema,
    changes: z.array(envelope).max(500),
  })
  .strict();
const resultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('applied'), payload: z.unknown(), version: versionSchema }),
  z.object({
    status: z.literal('conflict'),
    payload: z.unknown(),
    version: versionSchema.nullable(),
  }),
  z.object({ status: z.literal('invalid'), code: z.string() }),
]);
export class SupabaseRemoteSyncRepository implements RemoteSyncRepository {
  constructor(
    private client: SupabaseClient,
    private userId: string,
  ) {}
  private async call(
    name: string,
    args: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<unknown> {
    if (signal?.aborted) throw new DOMException('Stopped', 'AbortError');
    const {
      data: { session },
      error: sessionError,
    } = await this.client.auth.getSession();
    if (sessionError || session?.user.id !== this.userId)
      throw new SyncError('auth', 'Đăng nhập lại đúng tài khoản để đồng bộ.');
    try {
      if (signal?.aborted) throw new DOMException('Stopped', 'AbortError');
      // Bind the request to the verified session snapshot. A simultaneous account
      // switch must never send the old profile payload with the new user's token.
      const query = this.client
        .rpc(name, args)
        .setHeader('Authorization', `Bearer ${session.access_token}`);
      const { data, error, status } = await query.abortSignal(
        signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000),
      );
      if (error) {
        if (status === 401 || status === 403 || error.code === '28000' || error.code === 'PGRST301')
          throw new SyncError('auth', 'Đăng nhập lại để đồng bộ.');
        if (error.code?.startsWith('22') || error.code?.startsWith('23') || error.code === '55000')
          throw new SyncError(
            'validation',
            'Cloud từ chối dữ liệu hoặc đã được thiết lập trên thiết bị khác. Kiểm tra lại trạng thái cloud.',
          );
        if (status === 0)
          throw new SyncError(
            'network',
            'Chưa kết nối được cloud. Thay đổi vẫn được giữ trên thiết bị.',
          );
        throw new SyncError(
          'server',
          'Cloud chưa xử lý được yêu cầu. Kiểm tra cấu hình database hoặc thử lại sau.',
        );
      }
      return data;
    } catch (error) {
      if (error instanceof SyncError || signal?.aborted) throw error;
      throw new SyncError('network', 'Mất kết nối cloud. Hàng đợi được giữ để thử lại.');
    }
  }
  async pushMutation(m: Mutation, signal?: AbortSignal): Promise<PushResult> {
    const result = resultSchema.parse(
      await this.call(
        'sync_push',
        {
          mutation_id: m.mutationId,
          entity_type: m.entityType,
          payload: m.payload,
          base_version: m.baseVersion,
        },
        signal,
      ),
    );
    if (result.status === 'invalid') return result;
    const payload = result.payload === null ? null : schemas[m.entityType].parse(result.payload);
    if (result.status === 'applied' && (!payload || !result.version))
      throw new SyncError('server', 'Phản hồi đồng bộ không hợp lệ.');
    if (payload && payload.id !== m.entityId)
      throw new SyncError('server', 'Phản hồi sai bản ghi.');
    return { ...result, payload };
  }
  async pullChanges(
    after: string,
    limit = 200,
    upper?: string,
    signal?: AbortSignal,
  ): Promise<PullPage> {
    const page = pageSchema.parse(
      await this.call(
        'sync_pull',
        { after_version: after, page_limit: limit, upper_bound: upper ?? null },
        signal,
      ),
    );
    let previous = BigInt(after);
    const changes = page.changes.map((change) => {
      if (BigInt(change.version) <= previous || BigInt(change.version) > BigInt(page.upperBound))
        throw new SyncError('server', 'Thứ tự đồng bộ không hợp lệ.');
      previous = BigInt(change.version);
      return { ...change, payload: schemas[change.entityType].parse(change.payload) };
    });
    if (
      page.cursor !== String(previous) ||
      BigInt(page.upperBound) < previous ||
      (upper && BigInt(page.upperBound) > BigInt(upper))
    )
      throw new SyncError('server', 'Con trỏ đồng bộ không hợp lệ.');
    if (!changes.length && page.cursor !== page.upperBound)
      throw new SyncError('server', 'Thiếu trang dữ liệu đồng bộ.');
    return { ...page, changes };
  }
  async stage(
    id: string,
    records: { entityType: EntityType; payload: DomainRecord }[],
    signal?: AbortSignal,
  ) {
    await this.call('sync_stage', { bootstrap_id: id, records }, signal);
  }
  async initialize(id: string, count: number, signal?: AbortSignal) {
    await this.call('sync_initialize', { bootstrap_id: id, expected_count: count }, signal);
  }
}
