export default function Home() {
  return (
    <div className="flex min-h-full flex-1">
      {/* Left column — fixed 250px */}
      <aside className="w-[250px] shrink-0 border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Sidebar
          </h2>
        </div>
      </aside>
      <section className="min-w-0 flex-1 bg-zinc-50 dark:bg-zinc-950">

      {/* Middle column — max 380px */}
        <main className="p-4">
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            Tasks
          </h1>
      </main>
      <div className="w-full max-w-[380px] shrink-0 border-r border-zinc-200 dark:border-zinc-800">

      {/* Right column — fills remaining space */}
        <div className="p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Details
          </h2>
        </div>
      </section>
    </div>
  );
}
