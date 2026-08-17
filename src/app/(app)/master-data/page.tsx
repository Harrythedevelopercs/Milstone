import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

export default function MasterDataHomePage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Master Data</span>
          <Link href="/master-data/setup-guide" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Setup Guide
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Pick a section from the left to manage clients, merchants, companies, banks, and other
        reference data. New to setting this up? Start with the Setup Guide -- it walks through
        the right order so nothing ends up orphaned.
      </CardContent>
    </Card>
  );
}
