import "server-only";
import { db } from "./db";
import { DEMO_USER_ID } from "./demo-user";

export const TEST_SESSION_COOKIE = "ai_director_test_session";
export async function attachTestSession(sessionId: string | undefined, projectId: string) {
  if (!sessionId) return null;
  return db.userTestSession.updateMany({ where: { id: sessionId, userId: DEMO_USER_ID, projectId: null }, data: { projectId } });
}
export async function completeTestSession(projectId: string) {
  return db.userTestSession.updateMany({ where: { projectId, status: "STARTED" }, data: { status: "COMPLETED", completedAt: new Date() } });
}
