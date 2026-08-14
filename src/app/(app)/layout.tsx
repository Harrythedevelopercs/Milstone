import Link from "next/link";
import { requireUser } from "@/lib/rbac";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NavDropdown } from "@/components/nav-dropdown";
import { logoutAction } from "./actions";

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Owner",
  ACCOUNTANT: "Accountant",
  EMPLOYEE: "Employee",
};

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

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const canSeeMasterData = user.role === "OWNER" || user.role === "ACCOUNTANT";

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-semibold">
            FoundaPay ERP
          </Link>
          {canSeeMasterData && (
            <>
              <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
                Dashboard
              </Link>
              <Link
                href="/transactions"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Transactions
              </Link>
              <NavDropdown label="Money" items={MONEY_LINKS} />
              <NavDropdown label="Ledgers" items={LEDGER_LINKS} />
              <NavDropdown label="Payroll" items={PAYROLL_LINKS} />
              <Link
                href="/statements"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Statements
              </Link>
              <Link
                href="/month-close"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Month Close
              </Link>
              <Link
                href="/master-data"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Master Data
              </Link>
            </>
          )}
          {user.role === "EMPLOYEE" && (
            <Link
              href="/submit"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Submit Transaction
            </Link>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{user.name}</span>
          <Badge variant="secondary">{ROLE_LABEL[user.role]}</Badge>
          <form action={logoutAction}>
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
