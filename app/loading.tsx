export default function Loading() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6" aria-busy="true" aria-label="Loading">
      <div className="skeleton h-12 w-72" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-32" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <div className="skeleton h-96" />
        <div className="skeleton h-96" />
      </div>
    </div>
  );
}
