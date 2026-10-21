import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Section } from '@/components/ui/Section';
import PageHero from '@/components/layout/PageHero';
import JsonLd from '@/components/ui/JsonLd';
import { site } from '@/lib/site/config';
import { Badge } from '@/components/ui/Card';
import { getNewsPost, getNewsPosts } from '@/lib/queries';

export const revalidate = 300;

export function generateStaticParams() {
  return getNewsPosts().then((list) => list.map((n) => ({ slug: n.slug })));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getNewsPost(slug);
  if (!post) return { title: '社区动态' };
  return {
    title: post.title,
    description: post.summary,
    alternates: { canonical: `/news/${post.slug}` },
    // 分享图按本条标题生成 —— 与页面里的 Article JSON-LD 指向同一张图，
    // 避免「结构化数据说 A、分享卡片是 B」
    openGraph: {
      images: [
        `/api/og?title=${encodeURIComponent(post.title)}&subtitle=${encodeURIComponent(post.category)}`,
      ],
    },
  };
}

export default async function NewsDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getNewsPost(slug);
  if (!post) notFound();

  const related = (await getNewsPosts(post.category))
    .filter((n) => n.slug !== post.slug)
    .slice(0, 3);

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.summary,
    articleSection: post.category,
    datePublished: post.published_at,
    author: { '@type': 'Organization', name: post.author },
    publisher: { '@type': 'Organization', name: site.company, url: site.url },
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${site.url}/news/${post.slug}` },
    // Google Article 富媒体需要代表性图片；站内没有逐条配图，
    // 用动态 OG 图（按本条标题生成）而不是编一张不存在的照片
    image: `${site.url}/api/og?title=${encodeURIComponent(post.title)}&subtitle=${encodeURIComponent(post.category)}`,
    inLanguage: 'zh-CN',
  };

  return (
    <>
      <JsonLd data={articleJsonLd} />
      <PageHero
        eyebrow={post.category}
        title={post.title}
        desc={post.summary}
        crumbs={[
          { label: '首页', href: '/' },
          { label: '社区动态', href: '/news' },
          { label: post.title },
        ]}
      />

      <Section size="sm">
        <div className="mx-auto max-w-3xl">
          <div className="flex flex-wrap items-center gap-3 border-b border-[var(--color-line)] pb-6">
            <Badge tone="blue" className="text-[12px]">{post.category}</Badge>
            <time className="text-[13px] text-[var(--color-ink-3)]">{post.published_at}</time>
            <span className="text-[13px] text-[var(--color-ink-3)]">作者：{post.author}</span>
          </div>

          <article className="mt-8 space-y-5">
            {post.body.map((p, i) => (
              <p key={i} className="text-[15px] leading-[1.95] text-[var(--color-ink-2)]">
                {p}
              </p>
            ))}
          </article>

          {related.length > 0 && (
            <div className="mt-14 border-t border-[var(--color-line)] pt-8">
              <h2 className="text-[16px] font-semibold text-[var(--color-brand-navy)]">相关阅读</h2>
              <ul className="mt-5 space-y-3">
                {related.map((r) => (
                  <li key={r.slug}>
                    <Link
                      href={`/news/${r.slug}`}
                      className="group flex items-start gap-3 rounded-xl border border-[var(--color-line)] bg-white p-4 shadow-none transition-colors duration-200 hover:border-[var(--color-brand-blue-deep)]/40 hover:bg-[var(--color-surface)]"
                    >
                      <span className="mt-0.5 shrink-0 rounded bg-[var(--color-surface)] px-2 py-0.5 text-[12px] text-[var(--color-ink-3)]">
                        {r.category}
                      </span>
                      <span className="text-[14px] font-medium text-[var(--color-brand-navy)] group-hover:text-[var(--color-brand-blue-deep)]">
                        {r.title}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Section>
    </>
  );
}
