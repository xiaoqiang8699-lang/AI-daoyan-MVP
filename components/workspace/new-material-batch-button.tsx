"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function NewMaterialBatchButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function create() {
    setBusy(true);
    try {
      const response = await fetch("/api/material-batches", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const batch = await response.json();
      if (!response.ok) throw new Error(batch.error);
      router.push(`/workspace/materials?batch=${batch.id}`);
      router.refresh();
    } finally { setBusy(false); }
  }
  return <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void create()}><Plus />新建素材批次</Button>;
}
