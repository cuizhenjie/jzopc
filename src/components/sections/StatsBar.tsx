type Stat = { key: string; value: number; suffix: string; label: string };

/** Content metrics stay in the server HTML, without a counter animation. */
export default function StatsBar({ stats }: { stats: readonly Stat[] }) {
  return (
    <dl className="stats-strip">
      {stats.map((stat) => (
        <div key={stat.key}>
          <dt>{stat.label}</dt>
          <dd className="tnum">{stat.value}<span>{stat.suffix}</span></dd>
        </div>
      ))}
    </dl>
  );
}
