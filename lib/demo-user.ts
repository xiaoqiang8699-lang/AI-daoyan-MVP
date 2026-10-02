import { db } from "@/lib/db";

export const DEMO_USER_ID = "demo-user";

export async function ensureDemoUser() {
  return db.user.upsert({
    where: { id: DEMO_USER_ID },
    update: {},
    create: { id: DEMO_USER_ID, name: "体验用户", email: "demo@ai-director.local" },
  });
}
