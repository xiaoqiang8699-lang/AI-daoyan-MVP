import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { ensureDemoUser, DEMO_USER_ID } from "@/lib/demo-user";
import { publicError } from "@/lib/errors";
import { requireSameOrigin } from "@/lib/request-security";
import { TEST_SESSION_COOKIE } from "@/lib/test-sessions";

const input = z.object({ testerType: z.enum(["SHOP_OWNER", "ECOMMERCE_SELLER", "CREATOR", "PERSONAL_IP", "OTHER"]), experienceLevel: z.enum(["BEGINNER", "INTERMEDIATE", "EXPERIENCED"]), intendedContent: z.string().trim().min(1).max(200), pricingVariant: z.enum(["A", "B", "C"]).optional() });
export async function POST(request: Request) {
  try {
    requireSameOrigin(request); const body = input.parse(await request.json()); await ensureDemoUser();
    const count = await db.userTestSession.count({ where: { userId: DEMO_USER_ID } });
    const session = await db.userTestSession.create({ data: { userId: DEMO_USER_ID, testerLabel: `Tester ${String(count + 1).padStart(3, "0")}`, ...body, pricingVariant: body.pricingVariant || "B" } });
    (await cookies()).set(TEST_SESSION_COOKIE, session.id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 7 * 24 * 3600 });
    return Response.json({ id: session.id, testerLabel: session.testerLabel }, { status: 201 });
  } catch (error) { const failure = publicError(error); return Response.json({ error: failure.error }, { status: failure.status || 400 }); }
}
