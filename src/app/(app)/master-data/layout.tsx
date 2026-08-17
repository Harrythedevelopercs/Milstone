import Link from "next/link";
import {
  Users,
  Store,
  Building2,
  Handshake,
  Truck,
  UserCog,
  UserRound,
  Landmark,
  CreditCard,
  Banknote,
  Receipt,
  Package,
  Building,
  Settings,
  UserCircle,
  Boxes,
  BookOpen,
} from "lucide-react";
import { requireRole } from "@/lib/rbac";

const NAV_SECTIONS = [
  {
    title: "Parties",
    icon: UserCircle,
    links: [
      { href: "/master-data/clients", label: "Clients", icon: Users },
      { href: "/master-data/merchants", label: "Merchants", icon: Store },
      { href: "/master-data/companies", label: "Companies", icon: Building2 },
      { href: "/master-data/settlement-parties", label: "Settlement Parties", icon: Handshake },
      { href: "/master-data/vendors", label: "Vendors", icon: Truck },
    ],
  },
  {
    title: "People",
    icon: Users,
    links: [
      { href: "/master-data/employees", label: "Employees", icon: UserCog },
      { href: "/master-data/partners", label: "Partners", icon: UserRound },
    ],
  },
  {
    title: "Finance setup",
    icon: Boxes,
    links: [
      { href: "/master-data/banks", label: "Bank Accounts", icon: Landmark },
      { href: "/master-data/payment-methods", label: "Payment Methods", icon: CreditCard },
      { href: "/master-data/payout-methods", label: "Payout Methods", icon: Banknote },
      { href: "/master-data/expense-categories", label: "Expense Categories", icon: Receipt },
      { href: "/master-data/products-services", label: "Products & Services", icon: Package },
      { href: "/master-data/business-units", label: "Business Units", icon: Building },
      { href: "/master-data/chart-of-accounts", label: "Chart of Accounts", icon: BookOpen },
    ],
  },
  {
    title: "System",
    icon: Settings,
    links: [{ href: "/master-data/settings", label: "System Settings", icon: Settings }],
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
            <p className="mb-2 flex items-center gap-1.5 px-2 text-xs font-semibold uppercase text-muted-foreground">
              <section.icon className="size-3.5" />
              {section.title}
            </p>
            <div className="space-y-1">
              {section.links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                >
                  <link.icon className="size-4 text-muted-foreground" />
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
