import { prisma } from "@/lib/prisma";
import { EmployeesClient } from "./employees-client";

export default async function EmployeesPage() {
  const [employees, employeeUsers] = await Promise.all([
    prisma.employee.findMany({
      orderBy: { name: "asc" },
      include: { user: { select: { name: true, email: true } } },
    }),
    prisma.user.findMany({
      where: { role: "EMPLOYEE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    }),
  ]);

  const rows = employees.map((e) => ({
    id: e.id,
    name: e.name,
    email: e.email,
    phone: e.phone,
    isEmployeePartner: e.isEmployeePartner,
    salary: e.salary.toString(),
    status: e.status,
    userId: e.userId,
    user: e.user,
  }));

  return <EmployeesClient rows={rows} employeeUsers={employeeUsers} />;
}
