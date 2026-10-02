import { WorkspaceMobileNav } from "@/components/workspace/workspace-mobile-nav";
import { WorkspaceSidebar } from "@/components/workspace/workspace-sidebar";

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-svh bg-workspace">
    <WorkspaceSidebar />
    <main className="min-h-svh pb-20 lg:ml-64 lg:pb-0">{children}</main>
    <WorkspaceMobileNav />
  </div>;
}
