import Link from 'next/link';
import { site } from '@/lib/site/config';

/** 参考站页脚：结构与 class 对齐参考站 DOM（.ft / .ft__top / .ft__links / .ft__ct）。 */
export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="ft">
      <div className="wrap">
        <div className="ft__top">
          <div>
            <Link className="brand" href="/">
              <img className="brand__mark" src="/opc/reference/img/logo-icon.png" alt="集智 AI OPC 社区" width={40} height={40} />
              <span className="brand__txt">
                <span className="brand__cn">集智 <span style={{ color: '#3FE0F8' }}>AI</span></span>
                <span className="brand__en">JIZHI · AI</span>
              </span>
            </Link>
            <p className="ft__desc">
              集智 · 大健康+AI OPC 社区<br />
              健康管理 · AI 赋能 · 社区连接
            </p>
          </div>

          <div>
            <h5>平台</h5>
            <ul className="ft__links">
              <li><Link href="/health">大健康+AI</Link></li>
              <li><Link href="/empower">八大赋能</Link></li>
              <li><Link href="/market">供需发布</Link></li>
              <li><Link href="/growth">流量赋能</Link></li>
              <li><Link href="/academy">集智商学院</Link></li>
            </ul>
          </div>

          <div>
            <h5>了解我们</h5>
            <ul className="ft__links">
              <li><Link href="/about#intro">集智简介</Link></li>
              <li><Link href="/about#who">服务对象</Link></li>
              <li><Link href="/news">社区动态</Link></li>
            </ul>
          </div>

          <div>
            <h5>联系我们</h5>
            <ul className="ft__ct">
              <li>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <span>{site.address} · 首期 {site.area}</span>
              </li>
              <li>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" />
                </svg>
                <span>周一至周五 9:30 – 18:00</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="ft__bt">
          <span>© {year} {site.company}　保留所有权利</span>
          <span>{site.icp}</span>
        </div>
      </div>
    </footer>
  );
}
