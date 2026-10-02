import { Camera, MessageCircle, PersonStanding } from "lucide-react";

export function ShotInstructions({ shot }: { shot: { actionInstruction: string; cameraInstruction: string; dialogue: string | null } }) {
  return <dl className="space-y-4">{[
    { icon: PersonStanding, label: "动作", value: shot.actionInstruction },
    { icon: Camera, label: "相机位置", value: shot.cameraInstruction },
    ...(shot.dialogue ? [{ icon: MessageCircle, label: "台词", value: shot.dialogue }] : []),
  ].map(({ icon: Icon, label, value }) => <div key={label} className="flex gap-3"><Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><div className="min-w-0"><dt className="mb-1 text-xs text-muted-foreground">{label}</dt><dd className="text-sm leading-6">{value}</dd></div></div>)}</dl>;
}
