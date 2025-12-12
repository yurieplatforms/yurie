export default function LoadingProfilePage() {
  return (
    <div className="space-y-6 pb-8">
      {/* Cover */}
      <div className="h-48 w-full animate-pulse rounded-[var(--radius-card)] bg-[var(--color-surface)] sm:h-64" />

      {/* Avatar + name */}
      <div className="-mt-16 flex flex-col items-center gap-3">
        <div className="h-32 w-32 animate-pulse rounded-full bg-[var(--color-surface)] ring-[6px] ring-[var(--color-background)]" />
        <div className="h-6 w-44 animate-pulse rounded bg-[var(--color-surface)]" />
        <div className="h-4 w-32 animate-pulse rounded bg-[var(--color-surface)]" />
      </div>

      {/* Cards */}
      <div className="space-y-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)]"
          >
            <div className="h-12 animate-pulse bg-[var(--color-surface)]" />
            <div className="space-y-3 p-4">
              <div className="h-4 w-3/4 animate-pulse rounded bg-[var(--color-surface)]" />
              <div className="h-4 w-2/3 animate-pulse rounded bg-[var(--color-surface)]" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-[var(--color-surface)]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
