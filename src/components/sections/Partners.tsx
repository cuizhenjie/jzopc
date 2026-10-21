export default function Partners({ names }: { names: string[] }) {
  return (
    <div className="partners-section">
      <div className="partners-heading">
        <span className="section-eyebrow">产业生态</span>
        <h2>生态伙伴</h2>
      </div>
      <ul className="partner-wordmarks">
        {names.map((name) => <li key={name}>{name}</li>)}
      </ul>
    </div>
  );
}
