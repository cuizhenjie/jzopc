'use client';

import { useEffect } from 'react';
import {
  LEAD_ENDPOINT,
  buildApplyLeadPayload,
  buildMarketCardText,
  buildMarketLeadPayload,
  filterAgents,
  type MarketFormValues,
} from '@/lib/opc/form-payload';

/**
 * 参考站客户端行为层（2026-11-10 全站复刻）。
 *
 * 页面主体是**烘焙快照**（dangerouslySetInnerHTML 注入），不是 React 管理的 DOM，
 * 因此这里按参考站的 vanilla 语义直接操作 DOM —— 与参考站行为一致，
 * 且不存在 hydration 不一致风险。
 *
 * 移植的行为：
 *   - 滚动进场（.rv → .vis，带 data-d 阶梯延迟）
 *   - 数字滚动（[data-count]）
 *   - 回到顶部（.totop）
 *   - 社区动态折叠卡（.nitem__hd 点击展开 .nitem__body）
 *   - 社区动态类目筛选（[data-news-filter]）
 *   - 智能体目录：分类 chips + 关键词搜索 + 显示更多（#agentChips/#agentGrid/#agentCount/#agentMore）
 *   - 供需发布：需求/供给双 Tab + 表单校验 + 生成发布卡片（#sdNeed/#sdGive/#sdOut/#sdText/#sdCopy）
 *   - 入驻意向表：校验 + 提交到后台线索接口（#joinForm/#joinOk）
 *
 * 与参考站的差异（**刻意**）：
 *   1. 入驻表单与供需表单**直连后台**（POST /api/leads），不再只写 localStorage；
 *   2. 智能体目录数据由后台 agents 表渲染（见 blocks-runtime），此处只负责筛选交互。
 */

/**
 * 智能体目录的分类筛选。
 *
 * chips 的 `data-cat` 与卡片的 `data-opc-categories` 同源（都是后台分类 slug），
 * 因此筛选是**同值比对**，不需要别名表。
 */

function isReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function ReferenceInteractions({ route }: { route: string }) {
  useEffect(() => {
    const noAnim = /noanim/.test(window.location.search);
    // TEMP-DEBUG-TOP
    document.documentElement.setAttribute('data-ref-debug-top', `ran=${Date.now()}`);

    /* ---------- 滚动进场 ---------- */
    const revealTargets = Array.from(document.querySelectorAll<HTMLElement>('.rv'));
    if (revealTargets.length) {
      if (!('IntersectionObserver' in window) || noAnim || isReducedMotion()) {
        revealTargets.forEach((el) => el.classList.add('vis'));
      } else {
        const io = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (!entry.isIntersecting) return;
              const el = entry.target as HTMLElement;
              const delay = Number(el.getAttribute('data-d') ?? '0') * 70;
              el.style.transitionDelay = `${delay}ms`;
              el.classList.add('vis');
              io.unobserve(el);
            });
          },
          { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
        );
        revealTargets.forEach((el) => io.observe(el));
      }
    }

    /* ---------- 数字滚动 ---------- */
    const counters = Array.from(document.querySelectorAll<HTMLElement>('[data-count]'));
    const renderCount = (el: HTMLElement) => {
      const to = Number.parseFloat(el.getAttribute('data-count') ?? '0');
      const dec = Number.parseInt(el.getAttribute('data-dec') ?? '0', 10);
      if (!Number.isFinite(to)) return;
      if (noAnim || isReducedMotion()) {
        el.textContent = dec ? to.toFixed(dec) : Math.round(to).toLocaleString('en-US');
        return;
      }
      const start = performance.now();
      const duration = 1200;
      const step = (now: number) => {
        const p = Math.min(1, (now - start) / duration);
        const eased = to * (1 - Math.pow(1 - p, 3));
        el.textContent = dec ? eased.toFixed(dec) : Math.round(eased).toLocaleString('en-US');
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    if (counters.length) {
      if (!('IntersectionObserver' in window)) counters.forEach(renderCount);
      else {
        const io = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (!entry.isIntersecting) return;
              renderCount(entry.target as HTMLElement);
              io.unobserve(entry.target);
            });
          },
          { threshold: 0.5 },
        );
        counters.forEach((el) => io.observe(el));
      }
    }

    /* ---------- 回到顶部 ---------- */
    const totop = document.querySelector<HTMLElement>('.totop');
    if (totop) {
      const onScroll = () => totop.classList.toggle('on', window.scrollY > 700);
      onScroll();
      window.addEventListener('scroll', onScroll, { passive: true });
      totop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    }

    /* ---------- 社区动态：折叠卡 + 类目筛选 ---------- */
    document.querySelectorAll<HTMLElement>('.nitem__hd').forEach((head) => {
      head.addEventListener('click', () => {
        const item = head.closest<HTMLElement>('.nitem');
        if (!item) return;
        const wasOpen = item.classList.contains('on');
        document.querySelectorAll('.nitem.on').forEach((open) => open.classList.remove('on'));
        if (!wasOpen) item.classList.add('on');
      });
    });

    const filterButtons = Array.from(document.querySelectorAll<HTMLElement>('[data-news-filter]'));
    if (filterButtons.length) {
      filterButtons.forEach((button) => {
        button.addEventListener('click', () => {
          filterButtons.forEach((b) => b.classList.remove('on'));
          button.classList.add('on');
          const key = button.getAttribute('data-news-filter') ?? 'all';
          document.querySelectorAll<HTMLElement>('[data-news-cat]').forEach((el) => {
            const match = key === 'all' || el.getAttribute('data-news-cat') === key;
            el.style.display = match ? '' : 'none';
          });
        });
      });
    }

    // 带 hash 进来时展开对应条目（参考站 news.html 的内联脚本行为）
    const hash = window.location.hash.replace('#', '');
    if (hash) {
      const target = document.getElementById(hash);
      if (target?.classList.contains('nitem')) {
        target.classList.add('on');
        setTimeout(() => target.scrollIntoView({ block: 'start' }), 120);
      }
    }

    /* ---------- 智能体目录：分类 + 搜索 ---------- */
    const grid = document.getElementById('agentGrid');
    const chips = document.getElementById('agentChips');
    const countEl = document.getElementById('agentCount');
    const moreBtn = document.getElementById('agentMore');
    const searchInput = document.getElementById('agentSearch') as HTMLInputElement | null;
    if (grid) {
      const cards = Array.from(grid.querySelectorAll<HTMLElement>('.acard'));
      let current = 'all';
      let keyword = '';
      let limit = 36;

      const render = () => {
        // 筛选规则（分类同值比对 + 关键词命中）由纯函数实现，
        // 组件只负责把 DOM 卡片摊平成可比较的数据。
        const matched = filterAgents(
          cards.map((card) => ({
            card,
            text: card.textContent ?? '',
            search: card.getAttribute('data-opc-search') ?? '',
            categories: card.getAttribute('data-opc-categories') ?? '',
          })),
          current,
          keyword,
        ).map((entry) => entry.card);
        cards.forEach((card) => {
          card.style.display = 'none';
        });
        matched.slice(0, limit).forEach((card) => {
          card.style.display = '';
        });
        if (countEl) countEl.textContent = String(matched.length);
        if (moreBtn) {
          moreBtn.style.display = matched.length > limit ? '' : 'none';
          const label = moreBtn.querySelector('span');
          if (label) label.textContent = `显示更多（还有 ${Math.max(0, matched.length - limit)} 个）`;
        }
      };

      chips?.addEventListener('click', (event) => {
        const button = (event.target as HTMLElement).closest<HTMLElement>('.chip');
        if (!button) return;
        chips.querySelectorAll('.chip').forEach((b) => b.classList.remove('on'));
        button.classList.add('on');
        current = button.getAttribute('data-cat') ?? 'all';
        limit = 36;
        render();
      });

      searchInput?.addEventListener('input', () => {
        keyword = searchInput.value.trim().toLowerCase();
        limit = 36;
        render();
      });

      moreBtn?.addEventListener('click', () => {
        limit += 36;
        render();
      });

      render();
    }

    /* ---------- 供需发布：双 Tab + 表单 + 生成卡片 ---------- */
    const sdTabs = Array.from(document.querySelectorAll<HTMLElement>('.sdtabs__b'));
    const sdForms = {
      need: document.getElementById('sdNeed') as HTMLFormElement | null,
      give: document.getElementById('sdGive') as HTMLFormElement | null,
    };
    const sdOut = document.getElementById('sdOut');
    const sdText = document.getElementById('sdText');
    const sdCopy = document.getElementById('sdCopy');

    // TEMP-DEBUG
    document.getElementById('opc-page-content')?.setAttribute(
      'data-ref-debug',
      `sdTabs=${sdTabs.length} need=${!!sdForms.need} give=${!!sdForms.give} grid=${!!document.getElementById('agentGrid')} chips=${!!document.getElementById('agentChips')}`,
    );

    const picked = (form: HTMLFormElement, name: string): string[] =>
      Array.from(form.querySelectorAll<HTMLInputElement>(`input[name="${name}"]:checked`)).map((i) => i.value);

    const valueOf = (form: HTMLFormElement, name: string): string => {
      const el = form.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(`[name="${name}"]`);
      return el ? (el.value ?? '').trim() : '';
    };

    const markBad = (el: Element, bad: boolean): boolean => {
      const wrap = el.closest('.field');
      wrap?.classList.toggle('bad', bad);
      return !bad;
    };

    const validateSd = (form: HTMLFormElement, isNeed: boolean): boolean => {
      let ok = true;
      form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('[required]').forEach((el) => {
        ok = markBad(el, !(el.value ?? '').trim()) && ok;
      });
      const detail = form.querySelector<HTMLTextAreaElement>(isNeed ? '[name="detail"]' : '[name="product"]');
      if (detail) ok = markBad(detail, (detail.value ?? '').trim().length < 20) && ok;
      const group = isNeed ? 'needtype' : 'givetype';
      const box = form.querySelector(`input[name="${group}"]`);
      if (box) ok = markBad(box, picked(form, group).length === 0) && ok;
      if (!isNeed) {
        const way = form.querySelector('input[name="giveway"]');
        if (way) ok = markBad(way, picked(form, 'giveway').length === 0) && ok;
      }
      return ok;
    };

    /** 把表单读成取值面（字段名与参考站 form 的 name 属性一致）。 */
    const sdValues = (form: HTMLFormElement, isNeed: boolean): MarketFormValues => ({
      org: valueOf(form, 'org'),
      oneline: valueOf(form, 'oneline'),
      contact: valueOf(form, 'contact'),
      tel: valueOf(form, 'tel'),
      needTypes: picked(form, 'needtype'),
      detail: valueOf(form, 'detail'),
      budget: valueOf(form, 'budget'),
      when: valueOf(form, 'when'),
      giveTypes: picked(form, 'givetype'),
      product: valueOf(form, 'product'),
      boundary: valueOf(form, 'boundary'),
      giveWays: picked(form, 'giveway'),
      price: valueOf(form, 'price'),
      scope: valueOf(form, 'scope'),
    });

    const buildSdCard = (form: HTMLFormElement, isNeed: boolean): string =>
      buildMarketCardText(isNeed ? 'need' : 'give', sdValues(form, isNeed));

    sdTabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const current = tab.getAttribute('data-sd');
        sdTabs.forEach((other) => {
          const on = other === tab;
          other.classList.toggle('on', on);
          other.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        if (sdForms.need) sdForms.need.hidden = current !== 'need';
        if (sdForms.give) sdForms.give.hidden = current !== 'give';
        if (sdOut) sdOut.hidden = true;
      });
    });

    const setSdStatus = (status: string, note: string, failed = false) => {
      const statusEl = sdOut?.querySelector('.sdout__hd span');
      const noteEl = sdOut?.querySelector('.sdout__note');
      if (statusEl) statusEl.textContent = status;
      if (noteEl) noteEl.textContent = note;
      sdOut?.classList.toggle('is-error', failed);
    };

    Object.entries(sdForms).forEach(([key, form]) => {
      if (!form) return;
      const isNeed = key === 'need';
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
        if (button?.disabled) return;
        if (!validateSd(form, isNeed)) {
          form.querySelector('.field.bad')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
        const card = buildSdCard(form, isNeed);
        if (sdText) sdText.textContent = card;
        if (sdOut) {
          sdOut.hidden = false;
          sdOut.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        setSdStatus('正在提交后台，请稍候…', '提交完成前请勿重复操作。');
        const originalLabel = button?.textContent?.trim() || '生成发布卡片';
        if (button) {
          button.disabled = true;
          button.textContent = '提交中…';
        }
        // 直连后台：供需发布进入线索池，由运营在后台跟进并上架
        try {
          const response = await fetch(LEAD_ENDPOINT, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(buildMarketLeadPayload(isNeed ? 'need' : 'give', sdValues(form, isNeed))),
          });
          const result = (await response.json().catch(() => ({}))) as { ok?: boolean; message?: string };
          if (!response.ok || !result.ok) throw new Error(result.message || '提交失败');
          setSdStatus(
            '文案已生成并提交后台，待运营审核上架',
            '社区运营将在线索列表跟进；您也可以复制文案，直接发给社区对接人。',
          );
        } catch (error) {
          const reason = error instanceof Error ? error.message : '网络异常，请稍后重试';
          setSdStatus(
            '文案已生成，但后台提交失败，请重试；也可复制文案自行对接',
            `失败原因：${reason}。表单内容仍保留在页面中，修正后可重新提交。`,
            true,
          );
        } finally {
          if (button) {
            button.disabled = false;
            button.textContent = originalLabel;
          }
        }
      });
      form.querySelectorAll('input,select,textarea').forEach((el) => {
        el.addEventListener('input', () => {
          el.closest('.field')?.classList.remove('bad');
        });
      });
    });

    sdCopy?.addEventListener('click', async () => {
      const text = sdText?.textContent ?? '';
      const button = sdCopy as HTMLButtonElement;
      const done = () => {
        button.textContent = '已复制 ✓';
        window.setTimeout(() => { button.textContent = '复制文案'; }, 1800);
      };
      try {
        await navigator.clipboard.writeText(text);
        done();
      } catch {
        const area = document.createElement('textarea');
        area.value = text;
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        document.execCommand('copy');
        area.remove();
        done();
      }
    });

    /* ---------- 入驻意向表：校验 + 提交后台 ---------- */
    const joinForm = document.getElementById('joinForm') as HTMLFormElement | null;
    const joinOk = document.getElementById('joinOk');
    if (joinForm) {
      const fieldOf = (el: Element): HTMLElement | null =>
        (el.closest('.field') as HTMLElement | null) ?? (el.closest('.checks') as HTMLElement | null);

      joinForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        let bad = false;
        joinForm.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('[required]').forEach((field) => {
          const value = field instanceof HTMLInputElement && field.type === 'checkbox'
            ? field.checked
            : field.value.trim();
          const wrap = fieldOf(field);
          if (!value) {
            bad = true;
            wrap?.classList.add('bad');
          } else {
            wrap?.classList.remove('bad');
          }
        });
        const tel = joinForm.querySelector<HTMLInputElement>('[name="tel"]');
        if (tel && tel.value.trim() && !/^1[3-9]\d{9}$/.test(tel.value.trim())) {
          bad = true;
          fieldOf(tel)?.classList.add('bad');
        }
        if (bad) return;

        const needs = picked(joinForm, 'need');
        const payload = buildApplyLeadPayload({
          type: valueOf(joinForm, 'type'),
          size: valueOf(joinForm, 'size'),
          need: needs,
          team: valueOf(joinForm, 'team'),
          contact: valueOf(joinForm, 'contact'),
          tel: valueOf(joinForm, 'tel'),
          track: valueOf(joinForm, 'track'),
          intro: valueOf(joinForm, 'intro'),
          agree: joinForm.querySelector<HTMLInputElement>('[name="agree"]')?.checked === true,
        });

        const button = joinForm.querySelector<HTMLButtonElement>('button[type="submit"], .btn--primary');
        if (button) {
          button.disabled = true;
          button.textContent = '提交中…';
        }
        try {
          const response = await fetch(LEAD_ENDPOINT, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const result = (await response.json().catch(() => ({}))) as { ok?: boolean; message?: string };
          if (!response.ok || !result.ok) throw new Error(result.message || '提交失败');
          joinForm.style.display = 'none';
          if (joinOk) {
            joinOk.classList.add('on');
            joinOk.textContent = `✓ 已提交：${payload.orgName || ''}　我们将在 1 个工作日内与 ${payload.name || '您'} 联系。`;
            joinOk.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        } catch (error) {
          if (button) {
            button.disabled = false;
            button.textContent = '提交入驻意向';
          }
          if (joinOk) {
            joinOk.classList.add('on');
            joinOk.textContent = `提交失败：${error instanceof Error ? error.message : '请稍后重试'}，也可直接电话联系我们。`;
          }
        }
      });

      joinForm.querySelectorAll('input,select,textarea').forEach((field) => {
        field.addEventListener('input', () => {
          fieldOf(field)?.classList.remove('bad');
        });
      });
    }
  }, [route]);

  return null;
}
