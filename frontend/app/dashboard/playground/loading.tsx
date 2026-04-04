export default function PlaygroundLoading() {
  return (
    <div className="space-y-4 max-w-[1600px] animate-pulse">
      <div>
        <div className="h-7 w-48 rounded-lg bg-white/[0.06] mb-2" />
        <div className="h-4 w-96 rounded bg-white/[0.04]" />
      </div>

      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 h-16" />

      <div className="grid grid-cols-12 gap-4 min-h-[500px]">
        <div className="col-span-3 rounded-xl border border-white/[0.06] bg-white/[0.02]" />
        <div className="col-span-6 rounded-xl border border-white/[0.06] bg-white/[0.02]" />
        <div className="col-span-3 rounded-xl border border-white/[0.06] bg-white/[0.02]" />
      </div>

      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] h-52" />
    </div>
  );
}
