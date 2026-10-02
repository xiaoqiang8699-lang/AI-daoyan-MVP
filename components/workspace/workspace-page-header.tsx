import { Plus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function WorkspacePageHeader({ title, description, action = true }: { title: string; description: string; action?: boolean }) {
  return <header className="mb-7 flex flex-wrap items-start justify-between gap-4 sm:mb-9">
    <div><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p></div>
    {action && <Button asChild size="sm"><Link href="/projects/new"><Plus />上传素材</Link></Button>}
  </header>;
}
