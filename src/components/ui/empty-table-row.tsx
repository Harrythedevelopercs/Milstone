import type { LucideIcon } from "lucide-react";
import { TableCell, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";

export function EmptyTableRow({
  colSpan,
  message,
  description,
  icon,
}: {
  colSpan: number;
  message: string;
  description?: string;
  icon?: LucideIcon;
}) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="p-0">
        <EmptyState title={message} description={description} icon={icon} />
      </TableCell>
    </TableRow>
  );
}
