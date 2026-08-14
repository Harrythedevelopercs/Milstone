"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NavDropdown } from "@/components/nav-dropdown";

const MONEY_LINKS = [
  { href: "/settlements", label: "Settlements" },
  { href: "/payouts", label: "Payouts" },
  { href: "/expenses", label: "Expenses" },
  { href: "/product-sales", label: "Product/Service Sales" },
  { href: "/third-party", label: "Third-Party Settlements" },
  { href: "/transfers", label: "Internal Transfers" },
];

const LEDGER_LINKS = [
  { href: "/client-ledger", label: "Client Ledger" },
  { href: "/cash-position", label: "Cash Position" },
  { href: "/merchant-reconciliation", label: "Merchant Reconciliation" },
];

const PAYROLL_LINKS = [
  { href: "/distributions", label: "Monthly Distributions" },
  { href: "/partner-ledger", label: "Partner Ledger" },
  { href: "/employee-partner-ledger", label: "Employee Partner Ledger" },
  { href: "/bonus-pool", label: "Bonus Pool" },
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
          <NavDropdown
            label="Money"
            items={MONEY_LINKS}
            active={MONEY_LINKS.some((i) => isActive(pathname, i.href))}
          />
          <NavDropdown
            label="Ledgers"
            items={LEDGER_LINKS}
            active={LEDGER_LINKS.some((i) => isActive(pathname, i.href))}
          />
          <NavDropdown
            label="Payroll"
            items={PAYROLL_LINKS}
            active={PAYROLL_LINKS.some((i) => isActive(pathname, i.href))}
          />
          <NavLink
            href="/statements"
            label="Statements"
            active={isActive(pathname, "/statements")}
          />
          <NavLink
            href="/month-close"
            label="Month Close"
            active={isActive(pathname, "/month-close")}
          />
          <NavLink
            href="/master-data"
            label="Master Data"
            active={isActive(pathname, "/master-data")}
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
