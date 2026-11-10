import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { empowerDetails, getEmpowerDetail, getEmpowerDetailLive, listEmpowerSlugsLive } from '@/lib/data/empower';
import { empowerModules } from '@/lib/site/config';

export const revalidate = 3600;

export async function generateStaticParams() {
  // 静态内置模块 + 管理后台新增的 DB 模块（未预渲染的 slug 由 Next 按需渲染）
  const liveSlugs = await listEmpowerSlugsLive();
  const seen = new Set(empowerDetails.map((m) => m.slug));
  return [...empowerDetails.map((m) => ({ slug: m.slug })), ...liveSlugs.filter((s) => !seen.has(s)).map((slug) => ({ slug }))];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  // DB 优先：管理后台的下架/修改立即生效；无 DB 时回落内置内容
  const m = (await getEmpowerDetailLive(slug)) ?? getEmpowerDetail(slug);
  if (!m) return { title: '赋能模块' };
  return {
    title: `${m.title} · 集智 AI OPC 社区`,
    description: m.tagline,
    alternates: { canonical: `/empower/${m.slug}` },
  };
}

/**
 * 八大赋能详情页（原生路由，DB 驱动）。
 *
 * 2026-11-10 全站复刻后，版式对齐参考站的类名体系
 * （.pagehead / .sec / .shead / .card / .grid / .cta），样式由
 * /opc/reference/main.css（已加 .opc-site 作用域前缀）提供。
 */
export default async function EmpowerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // DB 优先（管理后台八大赋能），库内无/未发布 → 回落内置内容；都没有 → 404
  const m = (await getEmpowerDetailLive(slug)) ?? getEmpowerDetail(slug);
  if (!m) notFound();

  const related = empowerModules.filter((x) => m.related.includes(x.slug));

  return (
    <>
      <section className="pagehead">
        <div className="wrap">
          <span className="eyebrow">八大赋能 · {m.index}</span>
          <h1>{m.title}</h1>
          <p className="lead">{m.heroDesc}</p>
          <p className="lead" style={{ marginTop: 12 }}>{m.tagline}</p>
        </div>
      </section>

      <section className="sec">
        <div className="wrap">
          <div className="shead shead--center">
            <span className="eyebrow">VALUE · 核心价值</span>
            <h2>{m.title}能解决什么</h2>
          </div>
          <div className="grid g3">
            {m.values.map((v, i) => (
              <div className="card rv vis" key={v.title} data-d={i % 4}>
                <span className="card__no" style={{ fontSize: 34 }}>{String(i + 1).padStart(2, '0')}</span>
                <h3>{v.title}</h3>
                <p>{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {(m.highlights?.length || m.items.length) ? (
        <section className="sec sec--bg">
          <div className="wrap">
            <div className="split">
              <div className="rv vis">
                <span className="eyebrow">INCLUDED · 包含能力</span>
                <h2>这一项具体给到什么</h2>
                <ul className="slist" style={{ marginTop: 18 }}>
                  {m.items.map((item) => (
                    <li key={item}>
                      <i>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="m3 12 5 5L21 6" />
                        </svg>
                      </i>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                {m.pending ? <p style={{ marginTop: 18, fontSize: 13.5, color: '#8194AB' }}>{m.pending}</p> : null}
              </div>

              {m.highlights?.length ? (
                <div className="rv vis" data-d="1">
                  <span className="eyebrow">KEY FACTS · 关键数据</span>
                  <h2>落地时看这几个数</h2>
                  <div className="grid g2" style={{ marginTop: 20 }}>
                    {m.highlights.map((h) => (
                      <div className="card" key={h.label} style={{ padding: 20 }}>
                        <span style={{ fontSize: 13, color: '#5B6B82' }}>{h.label}</span>
                        <div style={{ fontSize: 26, fontWeight: 900, color: '#0D2B6E', marginTop: 6, letterSpacing: '-0.02em' }}>{h.value}</div>
                        {h.note ? <span style={{ display: 'block', marginTop: 6, fontSize: 12.5, color: '#8194AB' }}>{h.note}</span> : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {related.length ? (
        <section className="sec">
          <div className="wrap">
            <div className="shead shead--center">
              <span className="eyebrow">RELATED · 相关赋能</span>
              <h2>其他赋能模块</h2>
            </div>
            <div className="grid g4">
              {related.map((r) => (
                <Link className="card rv vis" key={r.slug} href={r.href}>
                  <span className="card__no" style={{ fontSize: 30 }}>{r.index}</span>
                  <h3>{r.title}</h3>
                  <p>{r.tagline}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="cta">
        <div className="cta__bg">
          <img src="/opc/reference/img/cta-robot.jpg" alt="" loading="lazy" decoding="async" />
        </div>
        <div className="wrap cta__in">
          <div>
            <h2>缺的那一环，直接补齐</h2>
            <p>加入集智 AI OPC 社区，获取办公空间、全套 AI 智能体能力与八大创业赋能资源，链接 AI 产业伙伴，加速项目落地。</p>
          </div>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <Link className="btn btn--mint" href="/apply">申请入驻</Link>
            <Link className="btn btn--ghost" href="/empower">看八大赋能总览</Link>
          </div>
        </div>
      </section>
    </>
  );
}
