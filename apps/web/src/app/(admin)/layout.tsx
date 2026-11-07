import type { ReactNode } from "react";
import { AdminNav } from "@/components/admin/admin-nav";
import { ProtectedRoute } from "@/components/protected-route";

/** Admin portal: clinic verification only; admins never see pets. */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <AdminNav />
      <main className="w-full min-w-0 flex-1 px-5 py-8 lg:px-10">
        <ProtectedRoute role="admin">{children}</ProtectedRoute>
      </main>
    </div>
  );
}
