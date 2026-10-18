import type {Metadata} from 'next';
import Link from 'next/link';
import {getSiteSettings} from '@/lib/queries';

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  return {title: settings.aboutHeading?.trim() || 'אודות', description: settings.aboutIntro?.trim() || settings.description || 'הסיפור שלנו', alternates: {canonical: '/about/'}};
}
export default async function AboutPage() {
  const settings = await getSiteSettings();
  const paragraphs = settings.aboutBody?.trim().split(/\n\s*\n/).filter(Boolean) ?? [];
  return <section className="container py-8 md:py-16">
    <div className="max-w-2xl space-y-6"><p className="section-label">אודות</p><h1 className="text-3xl font-normal leading-tight md:text-5xl">{settings.aboutHeading?.trim() || 'הסיפור שלנו'}</h1>
      {settings.aboutIntro?.trim() && <p className="whitespace-pre-line text-lg leading-8 text-[var(--muted)]" dir="auto">{settings.aboutIntro}</p>}
    </div>
    <div className="mt-8 max-w-2xl space-y-6 whitespace-pre-line break-words text-lg leading-8 text-[var(--muted)]">
      {paragraphs.length ? paragraphs.map((text, index) => <p key={index} dir="auto">{text}</p>) : <p>עוד מעט נשתף כאן את הסיפור שלנו. בינתיים, מוזמנות לגלות את הפריטים.</p>}
      <Link href="/catalog" className="tap inline-flex items-center gap-2 text-sm font-semibold text-[var(--ink)] underline underline-offset-4">לגלות את הקולקציה <span aria-hidden="true">←</span></Link>
    </div>
  </section>;
}
