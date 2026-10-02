import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { ensureDemoUser, DEMO_USER_ID } from "@/lib/demo-user";
import { requireSameOrigin } from "@/lib/request-security";
import { TEST_SESSION_COOKIE } from "@/lib/test-sessions";
export async function POST(request: Request) { requireSameOrigin(request); await ensureDemoUser(); const count = await db.userTestSession.count({ where: { userId: DEMO_USER_ID } }); const project = await db.project.create({ data: { userId: DEMO_USER_ID, name: `测试项目 ${String(count + 1).padStart(3, "0")}` } }); const session = await db.userTestSession.create({ data: { userId: DEMO_USER_ID, projectId: project.id, testerLabel: `Tester ${String(count + 1).padStart(3, "0")}`, testerType: "OTHER", experienceLevel: "BEGINNER", intendedContent: "待填写", pricingVariant: "B" } }); (await cookies()).set(TEST_SESSION_COOKIE, session.id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 7 * 24 * 3600 }); return Response.json({ projectId: project.id, sessionId: session.id }, { status: 201 }); }
