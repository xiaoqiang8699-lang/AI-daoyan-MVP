import { notFound } from "next/navigation";
import { PricingExperiment } from "@/components/pricing-experiment";
import { db } from "@/lib/db";
import { DEMO_USER_ID } from "@/lib/demo-user";
export default async function PricingPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; const session = await db.userTestSession.findFirst({ where: { projectId: id, userId: DEMO_USER_ID } }); if (!session) notFound(); return <div className="mx-auto max-w-3xl"><h1 className="text-3xl font-bold">体验结束后的价格测试</h1><PricingExperiment projectId={id} variant={session.pricingVariant} /></div>; }
