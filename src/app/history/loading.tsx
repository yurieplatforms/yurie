export default function LoadingHistoryPage() {
  return (
    <div className="space-y-6 pb-4">
      <div className="flex items-center justify-between">
        <div className="h-6 w-40 animate-pulse rounded bg-[var(--color-surface)]" />
        <div className="flex items-center gap-2">
          <div className="h-8 w-24 animate-pulse rounded-[var(--radius-full)] bg-[var(--color-surface)]" />
          <div className="h-8 w-24 animate-pulse rounded-[var(--radius-full)] bg-[var(--color-surface)]" />
        </div>
      </div>

      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-[var(--radius-card)] border border-[var(--color-border)] p-4"
          >
            <div className="h-4 w-48 animate-pulse rounded bg-[var(--color-surface)]" />
            <div className="mt-3 h-3 w-full animate-pulse rounded bg-[var(--color-surface)]" />
            <div className="mt-2 h-3 w-2/3 animate-pulse rounded bg-[var(--color-surface)]" />
          </div>
        ))}
      </div>
    </div>
  )
}
