import { redirect } from 'next/navigation';

// 流量超市已迁移至集智 AIGC 新媒体流量基地独立站点，直接跳转。
export default function TrafficPage() {
  redirect('https://th.jimei.cn');
}
