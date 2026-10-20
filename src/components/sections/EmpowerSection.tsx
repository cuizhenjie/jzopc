'use client';

import { useState } from 'react';
import EmpowerChain from '@/components/sections/EmpowerChain';
import EmpowerGrid from '@/components/sections/EmpowerGrid';

/**
 * 八大赋能区（客户端壳）。
 *
 * 只为承载「hover 卡片 → 链路节点点亮」这一个交互（docs/06 §4.1 D-02）。
 * 页面本身仍是服务端组件，这里的状态只影响 hover 高亮。
 */
export default function EmpowerSection() {
  const [active, setActive] = useState<string | null>(null);

  return (
    <>
      <EmpowerChain active={active} />
      <EmpowerGrid active={active} onHover={setActive} />
    </>
  );
}
