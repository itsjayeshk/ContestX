"use client";
import { Loader2, RefreshCcw, RotateCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";

export function SyncNowButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="secondary"
      size="sm"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const r = await api<{ outcomes: { platform: string; status: string; fetched: number; error?: string }[] }>("/api/admin/sync", { method: "POST" });
          const bad = r.outcomes.filter((o) => o.status === "FAILED");
          if (bad.length) toast.error(`Sync finished with ${bad.length} failing provider${bad.length > 1 ? "s" : ""}`, { description: bad.map((b) => `${b.platform}: ${b.error}`).join("\n") });
          else toast.success("Sync finished", { description: r.outcomes.map((o) => `${o.platform} ${o.status.toLowerCase()} (${o.fetched})`).join(", ") });
          router.refresh();
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Sync failed");
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? <Loader2 className="animate-spin" /> : <RefreshCcw />} Sync all providers now
    </Button>
  );
}

export function RetryFailedButton({ ids }: { ids: string[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (ids.length === 0) return null;
  return (
    <Button
      variant="secondary"
      size="sm"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const r = await api<{ requeued: number }>("/api/admin/retry", { method: "POST", json: { ids } });
          toast.success(`${r.requeued} reminder${r.requeued === 1 ? "" : "s"} requeued`, { description: r.requeued < ids.length ? "Reminders for contests that already started were left alone." : undefined });
          router.refresh();
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Could not requeue");
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? <Loader2 className="animate-spin" /> : <RotateCw />} Retry failed reminders
    </Button>
  );
}
