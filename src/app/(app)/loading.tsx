import { Skeleton } from "@/components/ui/skeleton";

// Route-level Suspense fallback for every page under the authenticated app
// shell -- the header/nav renders immediately (it's in layout.tsx, outside
// this boundary), and this shows instantly in the content area while a
// page's own data fetch is still in flight, instead of a blank screen. A
// generic approximation of the common page shape (title, filter/stat row,
// table) covers most pages reasonably; a route can still add its own more
// specific loading.tsx to override this for particularly different layouts.
export default function AppLoading() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-9 w-32" />
      </div>

      <div className="flex gap-3">
        <Skeleton className="h-16 w-40" />
        <Skeleton className="h-16 w-40" />
        <Skeleton className="h-16 w-40" />
      </div>

      <div className="space-y-2 rounded-md border p-4">
        <Skeleton className="h-6 w-full" />
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </div>
    </div>
  );
}
