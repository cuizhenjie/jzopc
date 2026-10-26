import { publicNavigation } from '@/lib/site/navigation';
import { site } from '@/lib/site/config';
import { getReplicaPage, REPLICA_SITE_NAME } from './content';
import { replicaPaths } from './routes';
import { trafficBase } from '@/lib/data/traffic-base';

export function buildReplicaLlmsTxt(): string {
  const base = site.url.replace(/\/$/, '');
  const account = new Set(['/opclogin', '/opcregister', '/opcforgotpassword', '/myinfo', '/opcapply', '/newsdetail']);
  return [
    `# ${REPLICA_SITE_NAME}`,
    '',
    '> 线上虚拟平台与线下实体空间，为OPC创业者提供全生命周期服务。',
    '',
    '本地科技蓝版本，公开内容来源为 https://opcstore.com/webNew/index.html#/ ，采集于2026-10-22。',
    '提供233个AI工具以及158条公开新闻、供需、课程、活动和社区资讯。',
    '账号、验证码和申请服务尚未接入，界面校验不代表账号创建或申请提交。',
    '',
    '## 规范入口',
    ...publicNavigation.map(item => `- [${item.label}](${base}${item.href})`),
    '',
    // 流量超市已从整页跳转独立站改回站内专页（2026-10-26），给 AI 助手补一句页面定位；
    // 同日页底留言表单下线，留资统一收敛到 /apply
    `流量超市是站内「${trafficBase.name}」专页：${trafficBase.slogan}，提供企业商业交付、FDE AI落地专项、院校产教共建与人才孵化培训，页底合作区统一引导至申请入驻页（/apply）留言。`,
    '',
    '社区动态列表优先展示数据库已发布内容，查询异常或未配置数据库时回落本地快照。',
    '旧列表 /news 永久重定向到 /newslist；旧查询参数不保留。新闻详情仍可访问。',
    '',
    '## 页面',
    ...replicaPaths.filter(path => !account.has(path)).map(path => {
      const page = getReplicaPage(path)!;
      return `- [${page.title.replace(` - ${REPLICA_SITE_NAME}`, '')}](${base}${path})`;
    }),
    '',
    `## 站点地图\n\n- [站点地图](${base}/sitemap.xml)`,
    '',
  ].join('\n');
}
