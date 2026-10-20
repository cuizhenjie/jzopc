/**
 * 静态降级背景：品牌渐变 + 静态星点。
 *
 * 纯 CSS，不依赖 WebGL、不依赖 JS 状态，因此可以被任意层级安全引用：
 *   - 3D 不可用时（无 WebGL2 / 减弱动效 / 省流量模式）
 *   - 3D 运行时抛错时（`ThreeErrorBoundary` 兜底）
 *   - JS 异常时（SSR HTML 里已包含它）
 *
 * 独立成文件是为了让 `Hero.tsx` 也能静态引用它，而不把 three 打进首屏包。
 */
export function StaticNebula({ className }: { className?: string }) {
  return (
    <div className={className} aria-hidden="true">
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 90% at 50% 18%, #1D7FBA 0%, #142F59 42%, #0E3769 72%, #0A2547 100%)',
        }}
      />
      <div
        className="absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            'radial-gradient(1.6px 1.6px at 18% 26%, rgba(255,255,255,.85), transparent 60%),' +
            'radial-gradient(1.2px 1.2px at 72% 18%, rgba(255,255,255,.65), transparent 60%),' +
            'radial-gradient(1.8px 1.8px at 84% 62%, rgba(87,182,165,.8), transparent 60%),' +
            'radial-gradient(1.1px 1.1px at 32% 74%, rgba(255,255,255,.55), transparent 60%),' +
            'radial-gradient(1.4px 1.4px at 52% 44%, rgba(26,168,211,.75), transparent 60%),' +
            'radial-gradient(1px 1px at 8% 58%, rgba(255,255,255,.45), transparent 60%)',
        }}
      />
      <div
        className="absolute inset-x-0 bottom-0 h-1/2"
        style={{ background: 'linear-gradient(to top, rgba(10,37,71,.92), transparent)' }}
      />
    </div>
  );
}

export default StaticNebula;
