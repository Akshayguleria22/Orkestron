export default function DashboardRouteLoading() {
  return (
    <div className="space-y-5 max-w-[1400px] animate-pulse">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-7 w-56 rounded-lg bg-white/[0.06] mb-2" />
          <div className="h-4 w-80 rounded bg-white/[0.04]" />
        </div>
        <div className="h-8 w-36 rounded-full bg-white/[0.05]" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-3">
            <div className="h-5 w-24 rounded bg-white/[0.05]" />
            <div className="h-7 w-20 rounded bg-white/[0.06]" />
            <div className="h-3 w-32 rounded bg-white/[0.04]" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <div className="h-5 w-48 rounded bg-white/[0.05] mb-4" />
          <div className="space-y-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-4 rounded bg-white/[0.04]" />
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <div className="h-5 w-28 rounded bg-white/[0.05] mb-4" />
          <div className="h-48 rounded bg-white/[0.04]" />
        </div>
      </div>
    </div>
  );
}
