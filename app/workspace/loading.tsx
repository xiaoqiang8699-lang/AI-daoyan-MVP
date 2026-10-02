export default function WorkspaceLoading() {
  return <div className="mx-auto max-w-[1480px] p-5 sm:p-8 lg:p-10">
    <div className="h-9 w-48 animate-pulse rounded-lg bg-muted" /><div className="mt-3 h-5 w-72 animate-pulse rounded bg-muted" />
    <div className="mt-10 grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]"><div className="space-y-7">{[0, 1, 2].map((item) => <div key={item} className="h-48 animate-pulse rounded-2xl bg-muted" />)}</div><div className="hidden h-96 animate-pulse rounded-2xl bg-muted xl:block" /></div>
  </div>;
}
