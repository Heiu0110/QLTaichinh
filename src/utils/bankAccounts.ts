import type { Account } from '../types/models';

export const bankPresets = [
  { id: 'bank:mb', name: 'MB Bank', logo: '/banks/mb.webp', aliases: ['mb', 'mbbank'] },
  {
    id: 'bank:vietin',
    name: 'VietinBank',
    logo: '/banks/vietinbank.webp',
    aliases: ['vietinbank', 'viettinbank'],
  },
  { id: 'bank:sacom', name: 'Sacombank', logo: '/banks/sacombank.webp', aliases: ['sacombank'] },
] as const;

export type BankPreset = (typeof bankPresets)[number];
export interface AccountChoice {
  id: string;
  name: string;
  logo?: string;
}
const normalize = (name: string) => name.toLocaleLowerCase('vi').replace(/\s+/g, '');
export function matchesBank(account: Account, bank: BankPreset) {
  return (
    !account.deletedAt &&
    account.type === 'bank' &&
    bank.aliases.some((alias) => alias === normalize(account.name))
  );
}
export function accountChoices(accounts: Account[]): AccountChoice[] {
  const included = new Set<string>();
  const banks = bankPresets.flatMap((bank) => {
    const existing = accounts.filter((account) => matchesBank(account, bank));
    if (!existing.length) return [{ id: bank.id, name: bank.name, logo: bank.logo }];
    return existing.map((account) => {
      included.add(account.id);
      return { id: account.id, name: account.name, logo: bank.logo };
    });
  });
  return [
    ...banks,
    ...accounts
      .filter((a) => !a.deletedAt && !included.has(a.id))
      .map(({ id, name }) => ({ id, name })),
  ];
}
