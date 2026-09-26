import { AlertTriangle, CheckCircle2 } from "lucide-react";

export function VerdictBanner({ regressed, total }: { regressed: number; total: number }) {
  const clean = regressed === 0;
  return <div className={`flex items-center justify-between gap-4 border px-5 py-5 ${clean ? "border-signal/40 bg-signal/10" : "border-alert/40 bg-alert/10"}`}>
    <div className="flex items-center gap-4">{clean ? <CheckCircle2 className="text-signal" /> : <AlertTriangle className="text-alert" />}<div><div className={`font-display text-xl font-semibold ${clean ? "text-signal" : "text-alert"}`}>{clean ? `All ${total} queries passed rehearsal.` : `${regressed} of ${total} queries regressed.`}</div><div className="mt-1 text-sm text-muted">{clean ? "The migration preserved the measured workload." : "The migration changes observed query behavior under rehearsal data."}</div></div></div>
  </div>;
}