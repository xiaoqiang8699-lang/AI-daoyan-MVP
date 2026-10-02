import { Card, CardContent } from "@/components/ui/card";
import { TestStartForm } from "@/components/test-start-form";
export default function TestStartPage() { return <div className="mx-auto max-w-xl"><h1 className="text-3xl font-bold">AI 导演体验测试</h1><p className="mt-3 text-sm text-muted-foreground">只需填写三项信息，随后按正常流程完成一个项目。</p><Card className="mt-6"><CardContent className="p-6"><TestStartForm /></CardContent></Card></div>; }
