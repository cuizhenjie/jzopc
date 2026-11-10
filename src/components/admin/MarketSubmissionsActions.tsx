'use client';

import { Button } from '@/components/admin/ui/button';

/** /admin/market 页头操作区：导出全部供需提交为 CSV（复用线索导出接口）。 */
export default function MarketSubmissionsActions() {
  return (
    <Button asChild variant="outline">
      <a href="/api/admin/leads/export?type=market">导出</a>
    </Button>
  );
}
