import { site } from '@/lib/site/config';
import { getReplicaPage } from './content';
import { replicaPaths } from './routes';

export function buildReplicaLlmsTxt(): string {
  const base = site.url.replace(/\/$/, '');
  const account = new Set(['/opclogin', '/opcregister', '/opcforgotpassword', '/myinfo', '/opcapply', '/newsdetail']);
  return [
    '# OPC Store · 同橙OPC社区',
    '',
    '> 线上虚拟平台与线下实体空间，为OPC创业者提供全生命周期服务。',
    '',
    '本地科技蓝版本，公开内容来源为 https://opcstore.com/webNew/index.html#/ ，采集于2026-10-22。',
    '提供233个AI工具、44个南京社区以及158条公开新闻、供需、课程、活动和社区资讯。',
    '账号、验证码和申请服务尚未接入，界面校验不代表账号创建或申请提交。',
    '',
    '## 页面',
    ...replicaPaths.filter(path => !account.has(path)).map(path => {
      const page = getReplicaPage(path)!;
      return `- [${page.title.replace(' - 同橙OPC社区平台', '')}](${base}${path})`;
    }),
    '',
    `## 站点地图\n\n- [站点地图](${base}/sitemap.xml)`,
    '',
  ].join('\n');
}
