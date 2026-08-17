// Standard "Company - Bank" display used everywhere a bank/USDT/cash
// account is shown, so two accounts named the same at the top level (e.g.
// two "Designory Inc" accounts) are always distinguishable. Falls back
// gracefully when either half is missing rather than showing "undefined".
export function bankAccountLabel(account: {
  name: string;
  bankName?: string | null;
  company?: { name: string } | null;
}): string {
  const bank = account.bankName?.trim() || account.name;
  const company = account.company?.name?.trim();
  return company ? `${company} - ${bank}` : bank;
}

export const BANK_ACCOUNT_LABEL_SELECT = {
  id: true,
  name: true,
  bankName: true,
  company: { select: { name: true } },
} as const;
