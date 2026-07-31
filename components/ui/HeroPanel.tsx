type HeroPanelProps = {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  aside?: React.ReactNode;
  children?: React.ReactNode;
};

export default function HeroPanel({
  eyebrow,
  title,
  description,
  meta,
  actions,
  aside,
  children,
}: HeroPanelProps) {
  return (
    <section className="race-hero relative isolate overflow-hidden rounded-[1.5rem] border">
      <div
        aria-hidden="true"
        className="hero-grid absolute inset-0 -z-10"
      />
      <div className="grid gap-7 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:p-10">
        <div className="min-w-0">
          {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
          <h2 className="mt-2 max-w-4xl text-3xl font-black tracking-[-0.035em] text-white sm:text-4xl lg:text-5xl">
            {title}
          </h2>
          {description ? (
            <div className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
              {description}
            </div>
          ) : null}
          {meta ? (
            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-300">
              {meta}
            </div>
          ) : null}
          {actions ? (
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              {actions}
            </div>
          ) : null}
        </div>
        {aside ? <div className="min-w-0 lg:min-w-64">{aside}</div> : null}
      </div>
      {children}
    </section>
  );
}
