import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { publicChromeMode, publicNavigation, navigationMatchesPath } from '@/lib/site/navigation';
import { nav, footerNav, intros, empowerModules } from '@/lib/site/config';

describe('one public navigation contract', () => {
  test('config consumes the same lightweight navigation instead of copying its links', () => {
    assert.equal(nav, publicNavigation);
    assert.equal(nav.length, 8);
    assert.equal(nav.filter(item => item.cta).length, 1);
    assert.equal(nav.find(item => item.href === '/about')?.children?.length, 4);
    assert.equal(nav.find(item => item.href === '/empower/space')?.children?.length, 8);
    assert.deepEqual(nav.find(item => item.href === '/newslist')?.children?.map(item => item.href), ['/newslist', '/activitylist']);
  });

  test('navigation and footer lead to the live tool, academy and community pages', () => {
    const links = [...nav.flatMap(item => [item.href, ...(item.children ?? []).map(child => child.href)]), ...footerNav.flatMap(group => group.links.map(item => item.href))];
    for (const path of ['/agent', '/center', '/newslist']) assert.ok(links.includes(path), path);
    for (const retired of ['/agents', '/academy', '/news']) assert.ok(!links.includes(retired), retired);
  });

  test('the renamed empowerment module is consistent with the confirmed introduction', () => {
    assert.equal(empowerModules.find(item => item.slug === 'market')?.title, '供需市场');
    assert.match(intros.v2, /供需市场/);
    assert.match(intros.v3.join(''), /供需市场/);
    assert.doesNotMatch(JSON.stringify([nav, intros, empowerModules]), /订单市场/);
  });

  test('legacy detail paths still highlight their canonical navigation parent', () => {
    assert.ok(navigationMatchesPath('/agents/writer', '/agent'));
    assert.ok(navigationMatchesPath('/academy/courses/aigc', '/center'));
    assert.ok(navigationMatchesPath('/news/community-launch', '/newslist'));
    assert.equal(navigationMatchesPath('/agents-unknown', '/agent'), false);
    assert.equal(navigationMatchesPath('/newsletter', '/newslist'), false);
  });
});

describe('public chrome route boundaries', () => {
  test('homepage and compatibility entry choose the dark-top header before hydration', () => {
    assert.equal(publicChromeMode('/'), 'home');
    assert.equal(publicChromeMode('/webNew/index.html'), 'home');
    assert.equal(publicChromeMode('/agent'), 'page');
    assert.equal(publicChromeMode('/empower/agents'), 'page');
  });

  test('account login shells and operations routes never acquire the public header', () => {
    for (const path of ['/opclogin', '/opcregister', '/opcforgotpassword', '/myinfo', '/opcapply', '/admin', '/admin/news', '/ops/leads', '/ADMIN/login/']) {
      assert.equal(publicChromeMode(path), 'independent', path);
    }
    for (const path of ['/about', '/apply', '/newslist', '/administrator', '/ops-example', '/opclogin-example']) {
      assert.equal(publicChromeMode(path), 'page', path);
    }
  });
});
