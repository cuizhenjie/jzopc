type Stat = { key: string; value: number; suffix: string; label: string };

/**
 * 内容指标保留在服务端 HTML 里（无 JS 也可读）；
 * data-stat-value 供首页 HomeFx 在客户端做滚动触发的数字滚动。
 * 数值与后缀分两个 span：后缀有独立样式（更小、蓝色），选择器见 globals.css。
 */
export default function StatsBar({ stats }: { stats: readonly Stat[] }) {
  return (
    <dl className="stats-strip">
      {stats.map((stat) => (
        <div key={stat.key}>
          <dt>{stat.label}</dt>
          <dd className="tnum"><span data-stat-value={stat.value}>{stat.value}</span><span className="stats-suffix">{stat.suffix}</span></dd>
        </div>
      ))}
    </dl>
  );
}
