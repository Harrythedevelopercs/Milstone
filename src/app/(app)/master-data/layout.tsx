import Link from "next/link";
import { requireRole } from "@/lib/rbac";

const NAV_SECTIONS = [
  {
    title: "Parties",
    links: [
      { href: "/master-data/clients", label: "Clients" },
      { href: "/master-data/merchants", label: "Merchants" },
      { href: "/master-data/companies", label: "Companies" },
      { href: "/master-data/settlement-parties", label: "Settlement Parties" },
      { href: "/master-data/vendors", label: "Vendors" },
    ],
  },
  {
    title: "People",
    links: [
      { href: "/master-data/employees", label: "Employees" },
      { href: "/master-data/partners", label: "Partners" },
    ],
  },
  {
    title: "Finance setup",
    links: [
      { href: "/master-data/banks", label: "Bank Accounts" },
      { href: "/master-data/payment-methods", label: "Payment Methods" },
      { href: "/master-data/payout-methods", label: "Payout Methods" },
      { href: "/master-data/expense-categories", label: "Expense Categories" },
      { href: "/master-data/products-services", label: "Products & Services" },
      { href: "/master-data/business-units", label: "Business Units" },
    ],
  },
  {
    title: "System",
    links: [{ href: "/master-data/settings", label: "System Settings" }],
  },
];

export default async function MasterDataLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole("OWNER", "ACCOUNTANT");

  return (
    <div className="flex gap-8">
      <nav className="w-56 shrink-0 space-y-6">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title}>
            <p className="mb-2 px-2 text-xs font-semibold uppercase text-muted-foreground">
              {section.title}
            </p>
            <div className="space-y-1">
              {section.links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="block rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
