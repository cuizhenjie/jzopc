import { advantages, visions } from '@/lib/site/config';

function NumberedList({ items }: { items: readonly string[] }) {
  return (
    <ol className="editorial-list">
      {items.map((item, index) => (
        <li key={item}>
          <span className="tnum">{String(index + 1).padStart(2, '0')}</span>
          <p>{item}</p>
        </li>
      ))}
    </ol>
  );
}

export function Advantages() {
  return (
    <div className="advantage-block">
      <span className="section-eyebrow">平台优势</span>
      <h2>为什么选择<br />集智 AI OPC？</h2>
      <NumberedList items={advantages} />
    </div>
  );
}

export function Vision() {
  return (
    <div className="vision-block">
      <span className="section-eyebrow">我们的愿景</span>
      <h2>让每一个 AI 项目<br />在此落地生长</h2>
      <p className="vision-intro">AI 时代，一个人也能是一家公司。我们把这家公司缺的每一环提前铺好。</p>
      <NumberedList items={visions} />
    </div>
  );
}
