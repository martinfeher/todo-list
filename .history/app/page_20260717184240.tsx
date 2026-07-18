export default function Home() {
  return (
    <div className="flex min-h-full flex-1">
      <aside className="w-[250px] shrink-0 border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
        <nav className="flex flex-col">
          {["Search", "Important", "Today"].map((label) => (
            <button
              key={label}
              type="button"
              className="flex h-[35px] w-full items-center px-4 text-left text-sm text-zinc-900 transition-colors hover:bg-zinc-200/60 dark:text-zinc-50 dark:hover:bg-zinc-800/60"
            >
              {label}
            </button>
          ))}
        </nav>
      </aside>
      hr
      <section className="min-w-0 flex-1 bg-zinc-50 dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800">
        <main className="p-4">
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            Tasks
          </h1>
        </main>
      <div className="w-full max-w-[380px] shrink-0">
        <div className="p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Details
          </h2>
        </div>
        </div>
      </section>
    </div>
  );
}
