import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { isAdminAuthed } from '@/lib/admin/auth';
import LoginForm from '@/components/admin/LoginForm';
import AdminBackdrop from '@/components/admin/AdminBackdrop';
import { brand } from '@/lib/site/config';

export const metadata: Metadata = {
  title: '登录 · 管理后台',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminLoginPage() {
  if (await isAdminAuthed()) redirect('/admin');

  return (
    <div
      data-nav-theme="light"
      className="relative flex min-h-[92vh] items-center justify-center overflow-hidden px-5 py-28"
      // CSS 渐变兜底层：WebGL 不可用 / shader 挂载前的首帧画面（与 MeshGradient 同色系）
      style={{
        background: `linear-gradient(135deg, ${brand.navy} 0%, ${brand.navyDeep} 55%, ${brand.gradientFrom} 130%)`,
      }}
    >
      <AdminBackdrop variant="login" />

      <div className="relative w-full max-w-[440px]">
        <div className="rounded-3xl border border-white/15 bg-white/[0.06] p-8 shadow-[0_24px_80px_-24px_rgb(0_0_0/0.45)] backdrop-blur-md sm:p-10">
          <p className="text-[12px] font-medium tracking-[0.2em] text-white/50">JIZHI ADMIN</p>
          <h1 className="mt-2 text-[26px] font-semibold text-white">管理后台登录</h1>
          <p className="mt-3 text-[13px] leading-relaxed text-white/60">
            管理留资线索与社区动态，仅供内部运营使用。请使用管理员账号登录。
          </p>

          <LoginForm />
        </div>

        <p className="mt-8 text-center text-[12px] text-white/40">
          不是运营人员？
          <Link href="/" className="ml-1 text-white/70 transition-colors hover:text-white">
            返回站点首页
          </Link>
        </p>
      </div>
    </div>
  );
}
