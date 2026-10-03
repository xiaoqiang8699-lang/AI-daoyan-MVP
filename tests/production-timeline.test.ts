import { test } from "node:test";
import assert from "node:assert/strict";
import { productionTimelineOutdated, type ProductionTimelineItem } from "../lib/production-timeline";
const item: ProductionTimelineItem = { order: 1, sourceType: "MATERIAL_ASSET", sourceId: "asset", mediaStorageKey: "materials/batch/assets/a.png", sourceDuration: 0, plannedDuration: 3, role: "HOOK", trimStart: null, trimEnd: null, mediaType: "IMAGE" };
test("内容制作时间线 snapshot 在来源或裁切变化时过期", () => {
  assert.equal(productionTimelineOutdated({ productionPlanId: "plan", timeline: [item] }, [item]), false);
  assert.equal(productionTimelineOutdated({ productionPlanId: "plan", timeline: [item] }, [{ ...item, trimEnd: 2 }]), true);
  assert.equal(productionTimelineOutdated({ productionPlanId: "plan", timeline: [item] }, [{ ...item, sourceId: "other" }]), true);
});
