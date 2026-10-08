import { z } from 'zod';
import {
  accountSchema,
  categorySchema,
  transactionSchema,
  budgetSchema,
  goalSchema,
  type Account,
  type Category,
  type Transaction,
  type Budget,
  type SavingsGoal,
} from '../types/models';
export const entityTypes = [
  'accounts',
  'categories',
  'transactions',
  'budgets',
  'savingsGoals',
] as const;
export type EntityType = (typeof entityTypes)[number];
export type DomainRecord = Account | Category | Transaction | Budget | SavingsGoal;
export const schemas = {
  accounts: accountSchema,
  categories: categorySchema,
  transactions: transactionSchema,
  budgets: budgetSchema,
  savingsGoals: goalSchema,
};
export const versionSchema = z
  .string()
  .regex(/^(0|[1-9]\d*)$/)
  .refine((v) => BigInt(v) <= 9223372036854775807n);
export interface Mutation {
  mutationId: string;
  entityType: EntityType;
  entityId: string;
  payload: DomainRecord;
  baseVersion: string | null;
  status: 'pending' | 'attempted' | 'blocked';
  dependsOnMutationId?: string;
  localOrder: number;
  attempts: number;
  nextAttemptAt: number;
}
export interface RemoteMeta {
  entityType: EntityType;
  entityId: string;
  version: string;
  payload: DomainRecord;
}
export interface SyncState {
  key: string;
  value: string;
}
export interface SyncConflict {
  id: string;
  entityType: EntityType;
  entityId: string;
  mutationId: string;
  localData: DomainRecord;
  remoteData: DomainRecord | null;
  baseVersion: string | null;
  remoteVersion: string | null;
  detectedAt: string;
  status: 'unresolved';
  reason: 'concurrent' | 'reference' | 'validation';
}
export interface Change {
  entityType: EntityType;
  payload: DomainRecord;
  version: string;
  mutationId: string;
}
export interface PullPage {
  initialized: boolean;
  upperBound: string;
  cursor: string;
  changes: Change[];
}
export type PushResult =
  | { status: 'applied'; payload: DomainRecord | null; version: string | null }
  | { status: 'conflict'; payload: DomainRecord | null; version: string | null }
  | { status: 'invalid'; code: string };
export class SyncError extends Error {
  constructor(
    public kind: 'network' | 'auth' | 'validation' | 'server',
    message: string,
  ) {
    super(message);
  }
}
export const entityKey = (type: EntityType, id: string) => `${type}:${id}`;
