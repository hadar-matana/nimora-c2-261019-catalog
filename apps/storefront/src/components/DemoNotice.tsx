export function DemoNotice({enabled}: {enabled: boolean}) {
  if (!enabled) return null;

  return (
    <div className="inline-flex max-w-xl border border-[var(--border)] bg-white/72 px-4 py-3 text-sm text-[var(--muted)]">
      זהו אתר הדגמה. שמות הפריטים, המחירים והמידות להמחשה בלבד.
    </div>
  );
}
