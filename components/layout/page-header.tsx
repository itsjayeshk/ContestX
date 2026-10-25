export function PageHeader({ title, children, aside }: { title: string; children?: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <h1 className="display text-[clamp(2rem,4.2vw,3rem)]">{title}</h1>
        {children && <p className="mt-3 max-w-2xl text-ink-2">{children}</p>}
      </div>
      {aside}
    </header>
  );
}
