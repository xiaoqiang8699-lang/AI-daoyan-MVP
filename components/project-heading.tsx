import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function ProjectHeading({ name, title, description }: { name: string; title: string; description?: string }) {
  return <div className="mb-8"><Link href="/projects" className="mb-7 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="size-4" />我的项目</Link><p className="mb-3 break-words text-sm text-muted-foreground">{name}</p><h1 className="text-2xl leading-snug font-bold sm:text-3xl">{title}</h1>{description && <p className="mt-3 text-sm leading-7 text-muted-foreground">{description}</p>}</div>;
}
