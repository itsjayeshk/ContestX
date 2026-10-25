"use client";
import { Globe } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Select } from "@/components/ui/field";
import { api } from "@/lib/api-client";
import { listTimezones, zoneLabel } from "@/lib/time";
import { cn } from "@/lib/cn";

export function TimezonePicker({ value, compact, onSaved }: { value: string; compact?: boolean; onSaved?: (tz: string) => void }) {
  const router = useRouter();
  const [tz, setTz] = useState(value);
  const [pending, start] = useTransition();
  // Built after mount: server and browser ICU can list different zones, which would break hydration.
  const [zones, setZones] = useState<[string, string][]>(() => [[value, ""]]);
  useEffect(() => {
    const now = new Date();
    const list = listTimezones();
    setZones((list.includes(value) ? list : [value, ...list]).map((z) => [z, zoneLabel(z, now)]));
  }, [value]);

  const change = (next: string) => {
    setTz(next);
    start(async () => {
      try {
        await api("/api/timezone", { method: "POST", json: { timezone: next } });
        toast.success(`Times now shown in ${next.replace(/_/g, " ")}`);
        onSaved?.(next);
        router.refresh();
      } catch (e) {
        setTz(value);
        toast.error(e instanceof Error ? e.message : "Could not change timezone");
      }
    });
  };

  return (
    <label className={cn("flex items-center gap-2", compact ? "text-[13px]" : "w-full")}>
      <Globe className="size-4 shrink-0 text-fog" aria-hidden />
      <span className="sr-only">Timezone</span>
      <Select value={tz} onChange={(e) => change(e.target.value)} disabled={pending} className={compact ? "h-9 w-56" : ""}>
        {zones.map(([z, label]) => (
          <option key={z} value={z}>
            {z.replace(/_/g, " ")}
            {label ? ` (${label})` : ""}
          </option>
        ))}
      </Select>
    </label>
  );
}
