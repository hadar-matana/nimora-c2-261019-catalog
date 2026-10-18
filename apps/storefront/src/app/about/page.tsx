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
  return <section className="container about-page">
    <div className="about-heading"><p className="section-label">אודות</p><h1>{settings.aboutHeading?.trim() || 'הסיפור שלנו'}</h1>
      {settings.aboutIntro?.trim() && <p className="about-intro" dir="auto">{settings.aboutIntro}</p>}
    </div>
    <div className="about-story">
      {paragraphs.length ? paragraphs.map((text, index) => <p key={index} dir="auto">{text}</p>) : <p>עוד מעט נשתף כאן את הסיפור שלנו. בינתיים, מוזמנות לגלות את הפריטים.</p>}
      <Link href="/catalog" className="editorial-link">לגלות את הקולקציה <span aria-hidden="true">←</span></Link>
    </div>
  </section>;
}
