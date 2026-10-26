/**
 * 流量超市（/traffic）页面契约。
 *
 * /traffic 的历史：先是有内容的站内页 → 2026-10-23 整页跳转独立站 th.jimei.cn →
 * 2026-10-26 改回站内页面（集智AIGC新媒体流量基地七大板块）。
 * 这里锁死三件事：
 *   1. **不得再跳转**——导航「流量超市」是顶层入口，整页 redirect 会把它变成死入口；
 *   2. **文案事实不丢**——案例数字、合规声明等关键事实必须逐字在数据文件里；
 *   3. **二维码位诚实**——图片没提供时不得渲染「扫描下方二维码」的引导。
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { trafficBase, trafficMiniappQr } from '@/lib/data/traffic-base';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const pageSource = readFileSync(resolve(repoRoot, 'src/app/traffic/page.tsx'), 'utf8');

describe('流量超市页面 · 不再跳转', () => {
  test('页面不再 redirect 到独立站，也不再引用 th.jimei.cn', () => {
    assert.ok(!pageSource.includes('th.jimei.cn'), '不得引用独立站地址');
    assert.ok(!/\bredirect\s*\(/.test(pageSource), '不得调用 next/navigation 的 redirect');
    assert.ok(!/permanentRedirect/.test(pageSource), '不得调用 permanentRedirect');
  });

  test('页面使用站内统一版式（PageHero + Section）并挂留言表单', () => {
    assert.ok(pageSource.includes('PageHero'));
    assert.ok(pageSource.includes('<Section'));
    assert.ok(pageSource.includes('leadType="traffic"'));
    assert.ok(pageSource.includes("canonical: '/traffic'"));
  });

  test('二维码位：图片未提供时不承诺「扫描二维码」', () => {
    if (trafficMiniappQr === null) {
      // 条件分支在页面里：只有 trafficMiniappQr 为真才出现扫码引导
      assert.ok(/trafficMiniappQr\s*\?/.test(pageSource), '扫码引导必须以二维码位存在为前提');
      assert.ok(pageSource.includes('<LeadForm'));
    }
  });
});

describe('流量基地数据 · 七大板块完整', () => {
  test('基地简介：使命 / 愿景 / 核心价值观与产业资源齐备', () => {
    assert.equal(trafficBase.intro.pillars.length, 3);
    assert.deepEqual(
      trafficBase.intro.pillars.map((p) => p.label),
      ['使命', '愿景', '核心价值观'],
    );
    assert.deepEqual(trafficBase.intro.values, ['实战育人', '商业共生', '务实创新', '多方共赢']);
    assert.ok(trafficBase.intro.industries.includes('大健康'));
    assert.match(trafficBase.intro.paragraph, /集美控股集团旗下北京集美科技有限公司/);
    assert.match(trafficBase.intro.paragraph, /40余年产业积淀/);
  });

  test('核心优势四项，关键事实逐字保留', () => {
    assert.equal(trafficBase.advantages.length, 4);
    const joined = trafficBase.advantages.map((a) => a.desc).join('');
    for (const fact of ['300余家头部企业', '10亿级战略并购', '月产数万条商业短视频', '双端小程序系统']) {
      assert.ok(joined.includes(fact), `优势里缺少事实：${fact}`);
    }
  });

  test('业务生态：B/S/C 三端四条线，每条服务项都有说明', () => {
    assert.equal(trafficBase.businesses.length, 4);
    assert.deepEqual(
      trafficBase.businesses.map((b) => b.tag),
      ['B端服务', 'B端服务', 'S端服务', 'C端服务'],
    );
    for (const b of trafficBase.businesses) {
      assert.ok(b.title.length > 0);
      assert.ok(b.items.length >= 3, `${b.title} 服务项过少`);
      for (const item of b.items) {
        assert.ok(item.title && item.desc, `${b.title} 存在空服务项`);
      }
    }
    const fde = trafficBase.businesses[1];
    assert.match(fde.title, /FDE/);
    assert.match(fde.lead ?? '', /Forward Deployed Engineer/);
  });

  test('人才成长闭环：六级阶梯顺序不可乱', () => {
    assert.deepEqual(trafficBase.growth.ladder, [
      '实训学员', '商业交付师', '签约员工', '助教', '带教', '项目合伙人',
    ]);
    assert.equal(trafficBase.growth.points.length, 2);
  });

  test('基地网络：三大基地 + 拓展中 + 合规注记', () => {
    assert.deepEqual(
      trafficBase.network.bases.map((b) => b.name),
      ['北京总部基地', '常熟流量基地', '上海流量基地'],
    );
    assert.match(trafficBase.network.more, /持续拓展中/);
    assert.match(trafficBase.network.note, /保障学生权益与数据安全/);
  });

  test('案例战报：五家品牌，主数字必须与事实列表一致', () => {
    assert.equal(trafficBase.cases.length, 5);
    for (const c of trafficBase.cases) {
      assert.ok(c.brand && c.facts.length >= 2, `${c.brand} 案例事实不完整`);
      // 主数字是事实列表中某一条的放大：数字必须真的出现在事实里
      const numberInFacts = c.facts.some((f) => f.includes(String(c.metric.value)));
      assert.ok(numberInFacts, `${c.brand} 的主数字 ${c.metric.value} 未出现在事实列表中`);
    }
    const bama = trafficBase.cases[0];
    assert.equal(bama.brand, '八马茶业');
    assert.ok(bama.facts.join('').includes('2400万+'));
    assert.ok(bama.facts.join('').includes('5亿+'));
  });

  test('合作邀请：三类受众、三条通道、合规声明逐字保留', () => {
    assert.deepEqual(
      trafficBase.invitation.audiences.map((a) => a.to),
      ['致企业', '致院校', '致学员'],
    );
    assert.deepEqual(trafficBase.invitation.channels, ['商务合作', '院校共建', '实训报名']);
    assert.match(trafficBase.invitation.compliance, /不向学生收取培训费、押金、设备费/);
    assert.match(trafficBase.invitation.compliance, /未经学校书面同意/);
  });
});
