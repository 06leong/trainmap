export function StatCard({
  label,
  value,
  detail
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-md border border-black/10 bg-white/72 p-4 shadow-sm">
      <div className="text-xs uppercase text-black/45">{label}</div>
      <div className="mt-3 font-display text-4xl text-ink">{value}</div>
      <div className="mt-2 text-sm text-black/58">{detail}</div>
    </div>
  );
}
