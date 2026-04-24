export function PageHeader({
  eyebrow,
  title,
  description,
  action
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-black/10 px-5 py-6 md:flex-row md:items-end md:justify-between lg:px-8">
      <div>
        <div className="text-xs uppercase text-black/45">{eyebrow}</div>
        <h1 className="mt-2 font-display text-4xl text-ink md:text-5xl">{title}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-black/62 md:text-base">{description}</p>
      </div>
      {action}
    </div>
  );
}
