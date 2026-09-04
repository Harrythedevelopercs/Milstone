"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { HoverNavItem } from "@/components/hover-nav-item";

const MONEY_LINKS = [
  { href: "/settlements", label: "Settlements" },
  { href: "/payouts", label: "Payouts" },
  { href: "/expenses", label: "Expenses" },
  { href: "/product-sales", label: "Product/Service Sales" },
  { href: "/third-party", label: "Third-Party Settlements" },
  { href: "/transfers", label: "Internal Transfers" },
  { href: "/refunds-chargebacks-voids", label: "Refunds/Chargebacks/Voids" },
];

const LEDGER_LINKS = [
  { href: "/client-ledger", label: "Client Ledger" },
  { href: "/cash-position", label: "Cash Position" },
  { href: "/merchant-reconciliation", label: "Merchant Reconciliation" },
  { href: "/reconciliation", label: "Bank/USDT/Cash Reconciliation" },
  { href: "/merchant-holds", label: "Merchant Hold/Reserve Report" },
];

const PAYROLL_LINKS = [
  { href: "/distributions", label: "Monthly Distributions" },
  { href: "/partner-ledger", label: "Partner Ledger" },
  { href: "/employee-partner-ledger", label: "Employee Partner Ledger" },
  { href: "/bonus-pool", label: "Bonus Pool" },
];

const STATEMENTS_LINKS = [
  { href: "/statements/income-statement", label: "Income Statement (P&L)" },
  { href: "/statements/balance-sheet", label: "Balance Sheet" },
  { href: "/statements/cash-flow", label: "Cash Flow" },
  { href: "/statements/consolidated-pnl", label: "Consolidated P&L" },
  { href: "/statements/company-pnl", label: "Company P&L" },
  { href: "/statements/business-unit-pnl", label: "Business Unit P&L" },
];

const MASTER_DATA_LINKS = [
  { href: "/master-data/clients", label: "Clients" },
  { href: "/master-data/merchants", label: "Merchants" },
  { href: "/master-data/companies", label: "Companies" },
  { href: "/master-data/settlement-parties", label: "Settlement Parties" },
  { href: "/master-data/vendors", label: "Vendors" },
  { href: "/master-data/employees", label: "Employees" },
  { href: "/master-data/partners", label: "Partners" },
  { href: "/master-data/banks", label: "Bank Accounts" },
  { href: "/master-data/payment-methods", label: "Payment Methods" },
  { href: "/master-data/payout-methods", label: "Payout Methods" },
  { href: "/master-data/expense-categories", label: "Expense Categories" },
  { href: "/master-data/products-services", label: "Products & Services" },
  { href: "/master-data/business-units", label: "Business Units" },
  { href: "/master-data/chart-of-accounts", label: "Chart of Accounts" },
  { href: "/master-data/settings", label: "System Settings" },
  { href: "/master-data/setup-guide", label: "Setup Guide" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "border-b-2 pb-[18px] pt-[18px] text-sm transition-colors",
        active
          ? "border-primary font-medium text-foreground"
          : "border-transparent text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground"
      )}
    >
      {label}
    </Link>
  );
}

export function AppNav({
  canSeeMasterData,
  isEmployee,
}: {
  canSeeMasterData: boolean;
  isEmployee: boolean;
}) {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-6">
      <Link href="/" className="flex items-center gap-2">
        <Image src="/foundapay-logo.png" alt="FoundaPay" width={124} height={25} priority unoptimized />
        <span className="text-sm font-medium text-muted-foreground">ERP</span>
      </Link>
      {canSeeMasterData && (
        <nav className="flex items-center gap-5">
          <NavLink href="/" label="Dashboard" active={pathname === "/"} />
          <NavLink
            href="/transactions"
            label="Transactions"
            active={isActive(pathname, "/transactions")}
          />
          <HoverNavItem
            label="Money"
            active={MONEY_LINKS.some((i) => isActive(pathname, i.href))}
            items={MONEY_LINKS}
          />
          <HoverNavItem
            label="Ledgers"
            active={LEDGER_LINKS.some((i) => isActive(pathname, i.href))}
            items={LEDGER_LINKS}
          />
          <HoverNavItem
            label="Payroll"
            active={PAYROLL_LINKS.some((i) => isActive(pathname, i.href))}
            items={PAYROLL_LINKS}
          />
          <HoverNavItem
            label="Statements"
            href="/statements"
            active={isActive(pathname, "/statements")}
            items={STATEMENTS_LINKS}
          />
          <NavLink
            href="/reminders"
            label="Reminders"
            active={isActive(pathname, "/reminders")}
          />
          <NavLink
            href="/month-close"
            label="Month Close"
            active={isActive(pathname, "/month-close")}
          />
          <NavLink
            href="/activity-log"
            label="Activity Log"
            active={isActive(pathname, "/activity-log")}
          />
          <HoverNavItem
            label="Master Data"
            href="/master-data"
            active={isActive(pathname, "/master-data")}
            items={MASTER_DATA_LINKS}
          />
        </nav>
      )}
      {isEmployee && (
        <nav className="flex items-center gap-5">
          <NavLink href="/submit" label="Submit Transaction" active={isActive(pathname, "/submit")} />
        </nav>
      )}
    </div>
  );
}
