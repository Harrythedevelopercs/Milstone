// Standard "Company - Bank" display used everywhere a bank/USDT/cash
// account is shown, so two accounts named the same at the top level (e.g.
// two "Designory Inc" accounts) are always distinguishable. Falls back
// gracefully when either half is missing rather than showing "undefined".
export function bankAccountLabel(account: {
  name: string;
  bankName?: string | null;
  company?: { name: string } | null;
  // Suffixed only for non-BANK types -- BANK is the common case and stays
  // unlabeled, so a Cash or USDT account (e.g. a "Paid from"/"Sent from"
  // source) is clearly distinguishable from a real bank account instead of
  // looking like one.
  accountType?: "BANK" | "USDT" | "CASH";
}): string {
  const bank = account.bankName?.trim() || account.name;
  const company = account.company?.name?.trim();
  const base = company ? `${company} - ${bank}` : bank;
  if (account.accountType === "CASH") return `${base} (Cash)`;
  if (account.accountType === "USDT") return `${base} (USDT)`;
  return base;
}

export const BANK_ACCOUNT_LABEL_SELECT = {
  id: true,
  name: true,
  bankName: true,
  accountType: true,
  company: { select: { name: true } },
} as const;
