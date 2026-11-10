/**
 * 公开路由表与参考站链接归一（src/lib/opc/routes.ts）的契约测试。
 *
 * ── 2026-11-10 全站复刻后 ───────────────────────────────────────────────
 *   公开路由 = 参考站的 10 个页面 + DB 驱动的 /newsdetail（共 11 条）。
 *   旧路由（/newslist、/center、/traffic、/work、/zone、/opclogin…）由
 *   next.config.ts 的 redirects() 以 308 收敛，不再是「路由表」的一部分。
 *
 * 删除的旧断言（逐条说明）：
 *   - 「18 条路由（含 /zone、/opclogin、/opcregister、/opcapply…）」
 *     → 旧站路由，随旧站下线；
 *   - 「#/news → /newslist 别名（old news channel）」→ /newslist 已下线，
 *     /news 不再别名到别处（见下方专门一条）。
 *   - 「#/Zone?city=… → /zone?city=…」「#/OpcApply?formType=…」
 *     → 对应页面已下线（现在只保留 queryKeys 允许的 id/city/cat/q/page 过滤能力）。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { isReplicaPath, replicaPaths, resolveReferenceLocation } from '@/lib/opc/routes';

const DOUBLE_SLASH = String.fromCharCode(47, 47);

test('公开路由表就是参考站的 10 个页面 + /newsdetail', () => {
  assert.equal(replicaPaths.length, 11);
  assert.deepEqual([...replicaPaths].sort(), [
    '/', '/about', '/academy', '/agent', '/apply', '/empower', '/growth',
    '/health', '/market', '/news', '/newsdetail',
  ]);
  assert.equal(new Set(replicaPaths).size, replicaPaths.length, '路由不得重复');
});

test('每条路由都可识别，且大小写与尾斜杠归一', () => {
  for (const path of replicaPaths) {
    assert.ok(isReplicaPath(path), path);
    assert.ok(isReplicaPath(path.toUpperCase()), path);
    assert.ok(isReplicaPath(`${path}/`), path);
    assert.equal(resolveReferenceLocation(path), path === '/' ? '/' : path);
  }
});

test('旧路由不再被识别（它们由 308 收敛表处理，不是路由表成员）', () => {
  for (const path of [
    '/newslist', '/activitylist', '/center', '/traffic', '/work', '/starproject',
    '/zone', '/opclogin', '/opcregister', '/opcforgotpassword', '/opcapply',
    '/community', '/computingresource', '/admin',
  ]) {
    assert.equal(isReplicaPath(path), false, path);
    assert.equal(resolveReferenceLocation(path), null, path);
  }
});

test('站内相对路径原样归一', () => {
  assert.equal(resolveReferenceLocation('/agent'), '/agent');
  assert.equal(resolveReferenceLocation('#/agent'), '/agent');
  assert.equal(resolveReferenceLocation('#/'), '/');
  assert.equal(resolveReferenceLocation('/'), '/');
  assert.equal(resolveReferenceLocation('/AGENT'), '/agent');
  assert.equal(resolveReferenceLocation('/agent/'), '/agent');
});

test('参考站域名下的绝对 URL 归一到站内路径', () => {
  assert.equal(resolveReferenceLocation('https://jizhi-ai-opc.app.workbuddy.host/agent'), '/agent');
  assert.equal(resolveReferenceLocation('https://jizhi-ai-opc.app/agent'), '/agent');
  assert.equal(resolveReferenceLocation('http://jizhi-ai-opc.app.workbuddy.host/market'), '/market');
});

test('保留允许的查询参数（?id= 等），丢弃其余', () => {
  assert.equal(resolveReferenceLocation('/newsdetail?id=392'), '/newsdetail?id=392');
  assert.equal(resolveReferenceLocation('#/newsdetail?id=392'), '/newsdetail?id=392');
  assert.equal(
    resolveReferenceLocation('https://jizhi-ai-opc.app.workbuddy.host/newsdetail?id=392'),
    '/newsdetail?id=392',
  );
  assert.equal(resolveReferenceLocation('/agent?q=React&page=2&token=private'), '/agent?q=React&page=2');
});

test('未知 / 畸形 / 外部地址一律不返回本地目标', () => {
  for (const value of [
    'https://evil.example/agent',
    `${DOUBLE_SLASH}evil.example/agent`,
    '/admin',
    'javascript:alert(1)',
    '/agent/../market',
    '/%2e%2e/agent',
    '/%2f%2fevil.example',
    `/agent${String.fromCharCode(92)}evil`,
    '#/agent#more',
    '/%FF',
    'https://user@jizhi-ai-opc.app.workbuddy.host/agent',
    'https://jizhi-ai-opc.app.workbuddy.host:8443/agent',
    '',
  ]) {
    assert.equal(resolveReferenceLocation(value), null, value);
  }
});

test('/news 不再别名到别处（社区动态只有一个正式入口）', () => {
  assert.equal(resolveReferenceLocation('#/news'), '/news');
  assert.equal(resolveReferenceLocation('/news'), '/news');
  assert.equal(resolveReferenceLocation('/newslist'), null);
  assert.equal(resolveReferenceLocation('#/newslist'), null);
  assert.equal(resolveReferenceLocation('#/activitylist'), null);
  assert.equal(resolveReferenceLocation('#/news/anything'), null);
  assert.equal(resolveReferenceLocation('#/newsletter'), null);
  assert.equal(resolveReferenceLocation('#/news/../agent'), null);
  assert.equal(resolveReferenceLocation('https://evil.example/#/news'), null);
});

test('带锚点的路径不被接受（路由归一只处理路径与查询）', () => {
  assert.equal(resolveReferenceLocation('/empower#capital'), null);
  assert.equal(resolveReferenceLocation('/about#intro'), null);
});

test('已下线的页面不再被解析出可跳转的本地目标', () => {
  assert.equal(resolveReferenceLocation('/zone?city=上海'), null);
  assert.equal(resolveReferenceLocation('/opcapply?formType=training'), null);
});
