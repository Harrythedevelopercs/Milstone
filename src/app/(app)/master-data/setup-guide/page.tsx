import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ToneBadge } from "@/components/ui/tone-badge";

const STEPS = [
  {
    n: 1,
    title: "Companies",
    href: "/master-data/companies",
    why: "The legal entities everything else hangs off of -- bank accounts, merchants, and expenses all optionally link to a company.",
  },
  {
    n: 2,
    title: "Bank Accounts",
    href: "/master-data/banks",
    why: "Add every real bank, USDT wallet, and cash drawer, tagged to the company that owns it. Merchants need one to settle into before you can create a merchant.",
  },
  {
    n: 3,
    title: "Chart of Accounts",
    href: "/master-data/chart-of-accounts",
    why: "Comes pre-populated with a standard set -- add or rename categories here if you want the Income Statement and Balance Sheet organized differently.",
  },
  {
    n: 4,
    title: "Payment Methods & Payout Methods",
    href: "/master-data/payment-methods",
    why: "How money comes in (Card, Wire, ACH, USDT...) and how it goes out to clients. Needed before you can enter a transaction or a payout.",
  },
  {
    n: 5,
    title: "Merchants",
    href: "/master-data/merchants",
    why: "Each merchant needs a company and a settlement bank account already set up. Add fee rules per payment method once the merchant exists.",
  },
  {
    n: 6,
    title: "Employees & Partners",
    href: "/master-data/employees",
    why: "Employees (mark the ones earning commission as Employee-Partners) and Partners (with their profit-share %). Merchants can optionally link to an employee-partner via their company.",
  },
  {
    n: 7,
    title: "Clients",
    href: "/master-data/clients",
    why: "Add the client, then immediately set their rate (from the client's page, \"Rates\") for each payment method they'll use -- a transaction can't be entered without a rate on file for that client + method + date.",
  },
  {
    n: 8,
    title: "Everything else",
    href: "/master-data",
    why: "Expense Categories, Vendors, Products & Services, Settlement Parties, Business Units -- add these as you need them; nothing else depends on them existing up front.",
  },
];

export default function SetupGuidePage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Setup Guide</h1>
        <p className="text-sm text-muted-foreground">
          The order that keeps everything correctly interlinked, so nothing ends up orphaned.
          Skipping ahead usually just means a dropdown is empty until you circle back.
        </p>
      </div>

      <div className="space-y-3">
        {STEPS.map((step) => (
          <Card key={step.n}>
            <CardHeader className="flex-row items-center gap-3 space-y-0">
              <ToneBadge tone="neutral">{step.n}</ToneBadge>
              <CardTitle className="text-base">
                <Link href={step.href} className="hover:underline">
                  {step.title}
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-sm text-muted-foreground">{step.why}</CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
