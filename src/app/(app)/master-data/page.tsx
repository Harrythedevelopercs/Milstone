import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function MasterDataHomePage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Master Data</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Pick a section from the left to manage clients, merchants, companies,
        banks, and other reference data.
      </CardContent>
    </Card>
  );
}
