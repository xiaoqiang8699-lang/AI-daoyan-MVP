import { ProjectHeading } from "@/components/project-heading";
import { NewProjectForm } from "@/components/new-project-form";
import { Card, CardContent } from "@/components/ui/card";

export default function NewProjectPage() {
  return <div className="mx-auto max-w-xl"><ProjectHeading name="新的灵感" title="这次，想拍点什么？" description="一个喜欢的视频，就是创作的起点。" /><Card><CardContent className="p-5 sm:p-7"><NewProjectForm /></CardContent></Card></div>;
}
