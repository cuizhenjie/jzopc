export default function Partners({ names }: { names: string[] }) {
  return (
    <div className="partners-section">
      <div className="partners-heading">
        <span className="section-eyebrow">产业生态</span>
        <h2>生态伙伴</h2>
      </div>
      <div className="partner-marquee">
        {/* 两份名单首尾相接做无缝循环；第二份对读屏隐藏 */}
        <ul className="partner-track">
          {names.map((name) => <li key={name}>{name}</li>)}
          {names.map((name) => <li key={`${name}-dup`} aria-hidden="true">{name}</li>)}
        </ul>
      </div>
    </div>
  );
}
