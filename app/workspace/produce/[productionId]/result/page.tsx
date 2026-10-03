import { notFound } from "next/navigation";
import { ProductionFinalVideoPanel } from "@/components/production-final-video-panel";
import { getProductionFinalVideoView } from "@/lib/production-final-video";
export default async function ProductionResultPage({ params }: { params: Promise<{ productionId: string }> }) {
  const productionId = (await params).productionId;
  let view;
  try { view = await getProductionFinalVideoView(productionId); } catch { notFound(); }
  return <main className="mx-auto max-w-3xl p-5 sm:p-8"><h1 className="text-2xl font-bold">成片结果</h1><ProductionFinalVideoPanel productionId={productionId} initial={view} /></main>;
}
