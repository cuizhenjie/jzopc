/**
 * 八大赋能的 monoline 图标（open-design 风格：1.6px 描边、圆角端点、无填充）。
 * 每个 slug 一枚，viewBox 24×24，继承 currentColor。
 */
const paths: Record<string, React.ReactNode> = {
  // 集智空间 —— 楼宇
  space: (
    <>
      <path d="M4 20h16" />
      <path d="M6 20V6.5A1.5 1.5 0 0 1 7.5 5h6A1.5 1.5 0 0 1 15 6.5V20" />
      <path d="M15 10h2.5A1.5 1.5 0 0 1 19 11.5V20" />
      <path d="M9 8.5h2M9 12h2M9 15.5h2" />
    </>
  ),
  // 算力超市 —— 芯片
  compute: (
    <>
      <rect x="7" y="7" width="10" height="10" rx="1.5" />
      <rect x="10.2" y="10.2" width="3.6" height="3.6" rx="0.8" />
      <path d="M9.5 4v3M14.5 4v3M9.5 17v3M14.5 17v3M4 9.5h3M4 14.5h3M17 9.5h3M17 14.5h3" />
    </>
  ),
  // 智能体 —— 机器人
  agents: (
    <>
      <rect x="5.5" y="9" width="13" height="9.5" rx="2" />
      <path d="M12 9V5.5" />
      <circle cx="12" cy="4.4" r="1.1" />
      <path d="M9.2 13h.9M13.9 13h.9" />
      <path d="M9.5 15.8c.7.5 1.6.8 2.5.8s1.8-.3 2.5-.8" />
      <path d="M3.5 12.5v3M20.5 12.5v3" />
    </>
  ),
  // 集智商学院 —— 翻开的书
  academy: (
    <>
      <path d="M12 6.5C10.6 5.1 8.5 4.5 4.5 4.5c-.3 0-.5.2-.5.5v12c0 .3.2.5.5.5 4 0 6.1.6 7.5 2 1.4-1.4 3.5-2 7.5-2 .3 0 .5-.2.5-.5V5c0-.3-.2-.5-.5-.5-4 0-6.1.6-7.5 2Z" />
      <path d="M12 6.5v13" />
    </>
  ),
  // 企服超市 —— 公文包
  enterprise: (
    <>
      <rect x="4" y="8" width="16" height="11" rx="2" />
      <path d="M9 8V6.5A1.5 1.5 0 0 1 10.5 5h3A1.5 1.5 0 0 1 15 6.5V8" />
      <path d="M4 12.5h16" />
      <path d="M11 12.5h2v2h-2z" />
    </>
  ),
  // 订单市场 —— 带勾的订单夹
  market: (
    <>
      <rect x="5.5" y="5" width="13" height="15" rx="1.8" />
      <path d="M9 5V4.2A1.2 1.2 0 0 1 10.2 3h3.6A1.2 1.2 0 0 1 15 4.2V5" />
      <path d="M9 12.2l2.1 2.1 3.9-4" />
    </>
  ),
  // 流量赋能 —— 广播信号
  traffic: (
    <>
      <circle cx="12" cy="13.5" r="1.6" />
      <path d="M8.6 16.9a4.4 4.4 0 0 1 0-6.8M15.4 10.1a4.4 4.4 0 0 1 0 6.8" />
      <path d="M6.2 19.3a8 8 0 0 1 0-11.6M17.8 7.7a8 8 0 0 1 0 11.6" />
    </>
  ),
  // 资本政策 —— 生长的芽
  capital: (
    <>
      <path d="M12 20v-7.5" />
      <path d="M12 12.5C12 9.5 9.6 7.5 6 7.5c0 3.5 2.4 5 6 5Z" />
      <path d="M12 10.5c0-2.8 2.2-4.5 5.5-4.5 0 3.2-2.2 4.5-5.5 4.5Z" />
      <path d="M7 20h10" />
    </>
  ),
};

export default function EmpowerIcon({ slug }: { slug: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[slug] ?? <circle cx="12" cy="12" r="7" />}
    </svg>
  );
}
