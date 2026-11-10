import { publicNavigation } from '@/lib/site/navigation';
import { site } from '@/lib/site/config';
import { getReplicaPage, REPLICA_SITE_NAME } from './content';
import { replicaPaths } from './routes';

/** llms.txt：给 AI 助手的站点摘要（入口、页面清单、事实边界）。 */
export function buildReplicaLlmsTxt(): string {
  const base = site.url.replace(/\/$/, '');
  const account = new Set(['/newsdetail']);
  return [
    `# ${REPLICA_SITE_NAME}`,
    '',
    '> 集美科技旗下的一站式 AI 应用综合赋能平台，位于北京丰台大红门，以八大赋能体系服务 AI 创业团队与一人公司。',
    '',
    '公开内容来源为参考站 https://jizhi-ai-opc.app.workbuddy.host/ ，采集于 2026-11-10。',
    '智能体目录、课程体系、社区动态、供需榜、统计数字与生态伙伴由后台数据库维护，前台按发布状态实时渲染。',
    '',
    '## 规范入口',
    ...publicNavigation.map((item) => `- [${item.label}](${base}${item.href})`),
    '',
    '关于集智包含四个锚点：集智简介（/about#intro）、发展历程（/about#history）、服务对象（/about#who）、生态伙伴（/about#eco）。',
    '八大赋能为单页总览（/empower），每个赋能模块另有独立详情页（/empower/<slug>）。',
    '',
    '社区动态列表优先展示数据库已发布内容，查询异常或未配置数据库时渲染空列表。',
    '旧列表 /newslist、/center、/traffic 永久重定向到 /news、/academy、/growth；旧查询参数不保留。新闻详情仍可访问。',
    '',
    '## 页面',
    ...replicaPaths.filter((path) => !account.has(path)).map((path) => {
      const page = getReplicaPage(path);
      if (!page) return '';
      return `- [${page.title.replace(` - ${REPLICA_SITE_NAME}`, '')}](${base}${path})`;
    }).filter(Boolean),
    '',
    `## 站点地图\n\n- [站点地图](${base}/sitemap.xml)`,
    '',
  ].join('\n');
}
