export default function AppLoading() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 rounded-full border-2 border-violet-500/30 border-t-violet-400 animate-spin mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">Loading Orkestron...</p>
      </div>
    </div>
  );
}
