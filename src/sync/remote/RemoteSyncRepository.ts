import type { Mutation, PullPage, PushResult, EntityType, DomainRecord } from '../syncTypes';
export interface RemoteSyncRepository {
  pushMutation(mutation: Mutation, signal?: AbortSignal): Promise<PushResult>;
  pullChanges(
    after: string,
    limit?: number,
    upper?: string,
    signal?: AbortSignal,
  ): Promise<PullPage>;
  stage(
    bootstrapId: string,
    records: { entityType: EntityType; payload: DomainRecord }[],
    signal?: AbortSignal,
  ): Promise<void>;
  initialize(bootstrapId: string, count: number, signal?: AbortSignal): Promise<void>;
}
