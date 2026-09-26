export type BisectionStep = { row_count: number; label?: string };

export function BisectionTrail({ steps }: { steps: BisectionStep[] }) {
  const largest = steps[0]?.row_count ?? 1;
  return <div className="flex min-h-[150px] items-end gap-2 border border-border bg-surface p-5">{steps.map((step, index) => <div className="flex flex-1 flex-col items-center gap-2" key={`${step.row_count}-${index}`}><div className="font-mono text-xs text-mono">{step.row_count.toLocaleString()}</div><div className="w-full animate-reveal bg-focus/70" style={{ height: `${Math.max(12, (step.row_count / largest) * 92)}px`, animationDelay: `${index * 120}ms` }} /><div className="font-mono text-[10px] text-muted">{step.label ?? `split ${index + 1}`}</div></div>)}</div>;
}