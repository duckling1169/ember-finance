export default function AppLoading() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-8 w-48 rounded bg-muted" />
      <div className="grid gap-3 lg:grid-cols-3">
        <div className="lg:col-span-2 h-64 rounded-lg bg-muted" />
        <div className="flex flex-col gap-3">
          <div className="flex-1 h-28 rounded-lg bg-muted" />
          <div className="flex-1 h-28 rounded-lg bg-muted" />
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        <div className="flex flex-col gap-3">
          <div className="flex-1 h-28 rounded-lg bg-muted" />
          <div className="flex-1 h-28 rounded-lg bg-muted" />
        </div>
        <div className="lg:col-span-2 h-64 rounded-lg bg-muted" />
      </div>
    </div>
  );
}
