import "server-only";

import { db } from "@/lib/db";
import { DEMO_USER_ID } from "@/lib/demo-user";

export type WorkspaceProject = {
  id: string; name: string; status: string; updatedAt: string; coverUrl: string | null;
  shotCount: number; capturedCount: number; planReady: boolean;
  firstShotId: string | null; finalVideo: null | { status: string; url: string | null; duration: number | null; subtitleReady: boolean; bgmEnabled: boolean };
};

export type WorkspaceDashboardData = {
  materials: Array<{ id: string; kind: "视频"; url: string; duration: number | null; createdAt: string; coverUrl: string | null }>;
  activeProjects: WorkspaceProject[];
  editingProjects: WorkspaceProject[];
  recentVideos: WorkspaceProject[];
  stats: { videos: number; capturedShots: number; retakes: number; downloads: number };
};

function mapProject(project: Awaited<ReturnType<typeof queryProjects>>[number]): WorkspaceProject {
  const planned = project.shootingPlan?.shots || [];
  const finalVideo = project.finalVideo;
  return {
    id: project.id, name: project.name, status: project.status, updatedAt: project.updatedAt.toISOString(),
    coverUrl: project.shots[0]?.referenceFrameUrl || null, shotCount: planned.length,
    capturedCount: planned.filter((shot) => shot.captureStatus === "CAPTURED").length,
    planReady: project.shootingPlan?.status === "READY", firstShotId: planned[0]?.id || null,
    finalVideo: finalVideo ? { status: finalVideo.status, url: finalVideo.enhancedFileUrl || finalVideo.fileUrl, duration: finalVideo.enhancedDuration || finalVideo.duration, subtitleReady: finalVideo.subtitleTrack?.status === "READY", bgmEnabled: Boolean(project.renderSettings?.bgmEnabled) } : null,
  };
}

async function queryProjects() {
  return db.project.findMany({
    where: { userId: DEMO_USER_ID }, orderBy: { updatedAt: "desc" },
    include: {
      referenceVideo: { select: { id: true, fileUrl: true, duration: true, createdAt: true } },
      shots: { orderBy: { order: "asc" }, take: 1, select: { referenceFrameUrl: true } },
      shootingPlan: {
        select: {
          status: true,
          shots: {
            orderBy: { order: "asc" },
            select: {
              id: true,
              captureStatus: true,
              selectedTake: { select: { id: true, videoUrl: true, duration: true, createdAt: true } },
            },
          },
        },
      },
      finalVideo: { select: { status: true, fileUrl: true, enhancedFileUrl: true, duration: true, enhancedDuration: true, subtitleTrack: { select: { status: true } } } },
      renderSettings: { select: { bgmEnabled: true } },
    },
  });
}

export async function getWorkspaceDashboard(): Promise<WorkspaceDashboardData> {
  const [projects, downloads, retakes] = await Promise.all([
    queryProjects(),
    db.productEvent.count({ where: { userId: DEMO_USER_ID, eventName: "FINAL_VIDEO_DOWNLOADED" } }),
    db.productEvent.count({ where: { userId: DEMO_USER_ID, eventName: "TAKE_EVALUATION_NEEDS_RETAKE" } }),
  ]);
  const mapped = projects.map(mapProject);
  const materials = projects.flatMap((project) => {
    const reference = project.referenceVideo ? [{ id: `reference-${project.referenceVideo.id}`, kind: "视频" as const, url: project.referenceVideo.fileUrl, duration: project.referenceVideo.duration, createdAt: project.referenceVideo.createdAt.toISOString(), coverUrl: project.shots[0]?.referenceFrameUrl || null }] : [];
    const takes = (project.shootingPlan?.shots || []).flatMap((shot) => shot.selectedTake ? [{ id: `take-${shot.selectedTake.id}`, kind: "视频" as const, url: shot.selectedTake.videoUrl, duration: shot.selectedTake.duration, createdAt: shot.selectedTake.createdAt.toISOString(), coverUrl: project.shots[0]?.referenceFrameUrl || null }] : []);
    return [...reference, ...takes];
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8);
  return {
    materials,
    activeProjects: mapped.filter((project) => project.planReady && ["READY_TO_SHOOT", "SHOOTING"].includes(project.status)).slice(0, 3),
    editingProjects: mapped.filter((project) => project.finalVideo && ["RENDERING", "FAILED"].includes(project.finalVideo.status)).slice(0, 3),
    recentVideos: mapped.filter((project) => project.finalVideo?.status === "READY" && project.finalVideo.url).slice(0, 6),
    stats: { videos: mapped.filter((project) => project.finalVideo?.status === "READY").length, capturedShots: mapped.reduce((total, project) => total + project.capturedCount, 0), retakes, downloads },
  };
}

export async function getWorkspaceProjects() { return (await queryProjects()).map(mapProject); }
