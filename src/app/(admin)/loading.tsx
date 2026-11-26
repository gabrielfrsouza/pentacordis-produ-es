export default function DashboardLoading() {
  return (
    <div aria-busy="true" aria-label="Carregando painel" className="animate-pulse">
      <div className="h-3 w-24 bg-neutral-100" />
      <div className="mt-3 h-10 w-56 bg-neutral-100" />
      <div className="mt-7 flex gap-3">
        {[0, 1, 2, 3].map((item) => <div key={item} className="h-10 w-36 bg-neutral-100" />)}
      </div>
      <div className="mt-7 grid gap-px border border-neutral-200 bg-neutral-200 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="h-32 bg-white p-6">
            <div className="h-3 w-24 bg-neutral-100" />
            <div className="mt-6 h-8 w-32 bg-neutral-100" />
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,0.7fr)]">
        <div className="h-80 border border-neutral-200 bg-neutral-100" />
        <div className="h-80 border border-neutral-200 bg-neutral-100" />
      </div>
    </div>
  );
}
