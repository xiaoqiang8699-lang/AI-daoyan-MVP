"use client";

import { useState } from "react";
import { Video } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ShootButton() {
  const [showNotice, setShowNotice] = useState(false);
  return <div><Button className="w-full" onClick={() => setShowNotice(true)}><Video />开始拍摄</Button>{showNotice && <p role="status" className="mt-3 rounded-xl bg-muted p-4 text-center text-sm leading-6">拍摄功能将在下一阶段启用。</p>}</div>;
}
