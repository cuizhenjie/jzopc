'use client';

import { createElement, useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { resolveReferenceLocation } from '@/lib/opc/routes';
import { facetMatches, parseCategories, validateReplicaFields } from './interaction-model';
import { mountVisualMotion } from './visual-motion';
// ⚠️ 设计层放在**客户端组件**里，而不是 Root Layout —— 两个原因：
//  1. Next.js 只允许全局 CSS 在根布局 import；Server Component 里 import
//     会被静默丢弃（实测设计层整层没进产物）。
//  2. 客户端组件的 CSS 落在 page.css，而实测加载顺序是
//     layout.css → reference-blue.css → **page.css**，
//     即设计层排在原站基线之后 —— 同特异性时设计层直接胜出，
//     不必再靠「把选择器写得比原站更长」来抢优先级。
// 导入顺序即层内顺序：token 先于组件，组件先于交互态。
import '@/styles/opc-tokens.css';
import '@/styles/opc-components.css';
import '@/styles/opc-visual.css';
import '@/styles/opc-interactions.css';
import '@/styles/opc-visual-motion.css';
import '@/styles/opc-layout-refresh.css';

type Props = { route: string; rootId?: string };
type Modal = { title: string; content: ReactNode; articleId?: string; loading?: boolean };
type Filters = { category: string; city: string; tab: string; query: string; limit: number };
const PAGE_SIZE = 20;
const cardSelector = '.tool-card,.course-card,.opc-card,.supply-card,.demand-card,.news-card,.news-item,.activity-item';
const formSelector = 'form,[role="form"]';
const marketTab = (value: string) => value === '需求' || value === 'demand' ? 'demand' : 'supply';

function safeContentUrl(value: string): string | undefined {
  if (/^\/(?!\/)/.test(value) && !/[\u0000-\u001f\\]/.test(value)) return value;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : undefined; }
  catch { return undefined; }
}

/** Rebuild article nodes with a narrow React allowlist; source markup is never executed. */
function articleNodes(html: string): ReactNode[] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const allowed = new Set(['p', 'br', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'strong', 'b', 'em', 'i', 'u', 's', 'span', 'div', 'section', 'figure', 'figcaption', 'img', 'a', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr']);
  const blocked = new Set(['script', 'style', 'iframe', 'object', 'embed', 'svg', 'math', 'form', 'input', 'button', 'link', 'meta', 'base']);
  const convert = (node: Node, key: string): ReactNode => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent;
    if (!(node instanceof Element)) return null;
    const tag = node.tagName.toLowerCase();
    if (blocked.has(tag)) return null;
    const children = Array.from(node.childNodes).map((child, index) => convert(child, `${key}-${index}`));
    if (!allowed.has(tag)) return children;
    if (tag === 'br' || tag === 'hr') return createElement(tag, { key });
    if (tag === 'img') {
      const src = safeContentUrl(node.getAttribute('src') ?? '');
      return src ? createElement('img', { key, src, alt: node.getAttribute('alt') ?? '', loading: 'lazy' }) : null;
    }
    if (tag === 'a') {
      const href = safeContentUrl(node.getAttribute('href') ?? '');
      return href ? createElement('a', { key, href, target: '_blank', rel: 'noopener noreferrer' }, children) : children;
    }
    return createElement(tag, { key }, children);
  };
  return Array.from(doc.body.childNodes).map((node, index) => convert(node, String(index)));
}

export default function ReplicaInteractions({ route, rootId = 'opc-page-content' }: Props) {
  const router = useRouter();
  const [modal, setModal] = useState<Modal | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const articleRequest = useRef<AbortController | null>(null);
  const modalOpen = modal !== null;

  useEffect(() => {
    if (!modalOpen || !dialog.current) return;
    const node = dialog.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    node.showModal();
    node.querySelector<HTMLButtonElement>('.opc-dialog-close')?.focus();
    return () => {
      articleRequest.current?.abort();
      if (node.open) node.close();
      document.body.style.overflow = overflow;
      if (opener.current?.isConnected) opener.current.focus();
    };
  }, [modalOpen]);

  useEffect(() => {
    const root = document.getElementById(rootId);
    if (!root) return;
    const cleanups: (() => void)[] = [];
    const path = route.split('?')[0].toLowerCase();
    const readFilters = (): Filters => {
      const params = new URLSearchParams(window.location.search);
      return {
        category: params.get('category') ?? '全部', city: params.get('city') ?? '全部',
        tab: marketTab(params.get('tab') ?? 'supply'),
        query: params.get('q') ?? '', limit: Math.max(1, Math.min(100, Number(params.get('page')) || 1)) * PAGE_SIZE,
      };
    };
    let filters = readFilters();
    const announce = (grid: HTMLElement, count: number) => {
      let status = grid.parentElement?.querySelector<HTMLElement>(`:scope > [data-opc-status="${grid.classList[0]}"]`);
      if (!status) {
        status = document.createElement('p'); status.dataset.opcStatus = grid.classList[0];
        status.dataset.opcGenerated = 'true'; status.setAttribute('role', 'status');
        grid.after(status);
      }
      status.className = count ? 'opc-live-status' : 'opc-empty-results';
      status.textContent = count ? `找到 ${count} 项内容` : '没有找到相关内容，请调整筛选条件或搜索关键词。';
    };

    const filterGrid = (selector: string, category: string, facet: 'category' | 'city' = 'category', paginate = false, announceResults = true) => {
      let total = 0;
      root.querySelectorAll<HTMLElement>(selector).forEach(grid => {
        let matching = 0;
        Array.from(grid.children).forEach(element => {
          if (!(element instanceof HTMLElement) || !element.matches(`${cardSelector},[data-opc-id]`)) return;
          const categories = facet === 'city' ? [element.dataset.opcCity ?? '']
            : parseCategories(element.dataset.opcCategories ?? element.dataset.opcCategory);
          const matches = facetMatches(element.textContent ?? '', categories, category, filters.query);
          if (matches) matching += 1;
          element.hidden = !matches || (paginate && matching > filters.limit);
        });
        total += matching;
        if (announceResults) announce(grid, matching);
      });
      return total;
    };

    const syncFilterButtons = () => {
      root.querySelectorAll<HTMLElement>('[data-opc-action^="filter-"]').forEach(button => {
        const action = button.dataset.opcAction;
        if (action === 'filter-zone' || action === 'filter-gpu') return;
        const value = button.dataset.opcValue ?? button.textContent?.trim() ?? '';
        const current = action === 'filter-city' ? filters.city
          : action === 'filter-market' ? filters.tab : filters.category;
        const isAll = (text: string) => /^全部/.test(text) || text === 'all';
        const active = action === 'filter-market' ? marketTab(value) === marketTab(current) : value === current || (isAll(value) && isAll(current));
        button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active));
      });
    };

    const renderLists = (persist = false) => {
      let total = 0;
      if (path === '/agent') {
        // One summary covers all categories. Empty sections must not leave headings
        // and multiple empty messages between the matching groups.
        total = filterGrid('.tool-grid', filters.category, 'category', false, false);
        root.querySelectorAll<HTMLElement>('[data-opc-agent-group]').forEach(group => {
          group.hidden = !Array.from(group.querySelectorAll<HTMLElement>('.tool-card')).some(card => !card.hidden);
        });
        const count = root.querySelector<HTMLElement>('.filter-stats strong');
        if (count) count.textContent = String(total);
        const status = root.querySelector<HTMLElement>('[data-opc-agent-status]');
        if (status) {
          status.className = total ? 'opc-agent-status' : 'opc-agent-status opc-empty-results';
          status.textContent = total ? `共 ${total} 个智能体` : '没有找到相关智能体，请调整分类或搜索关键词。';
          status.hidden = false;
        }
      }
      else if (path === '/center') total = filterGrid('.course-grid', filters.category);
      else if (path === '/community') {
        total = filterGrid('.opc-grid', filters.city, 'city');
        filterGrid('.news-grid', filters.category);
      }
      else if (path === '/newslist') total = filterGrid('.news-list', filters.category, 'category', true);
      else if (path === '/activitylist') total = filterGrid('.activity-list', filters.category, 'category', true);
      else if (path === '/market') {
        const demand = marketTab(filters.tab) === 'demand';
        root.querySelectorAll<HTMLElement>('.supply-sec').forEach(section => { section.hidden = demand; section.classList.toggle('active', !demand); });
        root.querySelectorAll<HTMLElement>('.demand-sec').forEach(section => { section.hidden = !demand; section.classList.toggle('active', demand); });
        total = filterGrid(demand ? '.demand-grid' : '.supply-grid', '全部', 'category', true);
      }
      if (['/market', '/newslist', '/activitylist'].includes(path)) {
        root.querySelectorAll<HTMLButtonElement>('[data-opc-action="load-more"],.load-more-btn').forEach(button => {
          button.hidden = total <= filters.limit; button.disabled = total <= filters.limit;
        });
      }
      syncFilterButtons();
      if (persist) {
        const url = new URL(window.location.href);
        for (const [key, value] of Object.entries({ q: filters.query, category: filters.category, city: filters.city, tab: filters.tab, page: String(filters.limit / PAGE_SIZE) })) {
          const isDefault = !value || /^全部/.test(value) || value === 'all' || (key === 'tab' && value === 'supply') || (key === 'page' && value === '1');
          if (isDefault) url.searchParams.delete(key); else url.searchParams.set(key, value);
        }
        window.history.replaceState(window.history.state, '', url);
      }
    };

    const navigate = (candidate: string) => {
      const local = resolveReferenceLocation(candidate);
      if (!local) return false;
      router.push(local); return true;
    };

    const openInfo = (title: string, text: string, target?: HTMLElement) => {
      opener.current = target ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
      setModal({ title, content: <p>{text}</p> });
    };

    const showArticle = async (id: string, target: HTMLElement) => {
      if (!/^\d+$/.test(id)) { openInfo('内容详情', '该内容尚未提供可访问的详情。', target); return; }
      opener.current = target; articleRequest.current?.abort();
      const request = new AbortController(); articleRequest.current = request;
      setModal({ title: '内容详情', content: <p role="status">正在加载内容…</p>, articleId: id, loading: true });
      try {
        const response = await fetch(`/api/opc/content?id=${encodeURIComponent(id)}`, { signal: request.signal, credentials: 'same-origin' });
        if (!response.ok) throw new Error('content unavailable');
        const data: unknown = await response.json();
        if (!data || typeof data !== 'object' || !('title' in data) || !('html' in data) || typeof data.title !== 'string' || typeof data.html !== 'string') throw new Error('invalid content');
        if (request.signal.aborted) return;
        setModal(current => current?.articleId === id ? { title: data.title as string, content: articleNodes(data.html as string), articleId: id } : current);
      } catch {
        if (!request.signal.aborted) setModal(current => current?.articleId === id ? { title: '内容暂时无法加载', content: <p>请稍后重试，或<a href={`/newsdetail?id=${id}`}>打开详情页面</a>。</p> } : current);
      }
    };

    const formMessage = (form: HTMLElement, text: string, error = false) => {
      let node = form.querySelector<HTMLElement>('[data-opc-form-status]');
      if (!node) { node = document.createElement('p'); node.dataset.opcFormStatus = 'true'; node.dataset.opcGenerated = 'true'; form.append(node); }
      node.className = `opc-form-status${error ? ' opc-form-error' : ''}`;
      node.setAttribute('role', error ? 'alert' : 'status'); node.textContent = text;
    };

    const submitLocalForm = (form: HTMLElement) => {
      const inputs = Array.from(form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input:not([type="checkbox"]):not([type="hidden"]),textarea,select'));
      const fields = inputs.map((input, index) => {
        const label = input.closest('.form-group,.el-form-item')?.querySelector('label')?.textContent?.replace(/\*/g, '').trim() || input.getAttribute('placeholder')?.replace(/^请输入|^请填写|^请设置/, '') || `第${index + 1}项`;
        return { label, value: input.value, type: input instanceof HTMLInputElement ? (input.dataset.opcOriginalType ?? input.type) : 'text', required: input.required };
      });
      inputs.forEach(input => { input.removeAttribute('aria-invalid'); input.classList.remove('opc-invalid'); });
      form.querySelectorAll('[data-opc-field-error]').forEach(node => node.remove());
      const errors = validateReplicaFields(fields, path);
      errors.forEach(error => {
        const input = inputs[error.index]; input.setAttribute('aria-invalid', 'true'); input.classList.add('opc-invalid');
        const node = document.createElement('span'); node.dataset.opcFieldError = 'true'; node.dataset.opcGenerated = 'true';
        node.className = 'opc-field-error'; node.textContent = error.message;
        input.closest('.form-input-wrapper,.el-input')?.after(node);
      });
      if (errors.length) { formMessage(form, '请检查填写内容后再试。', true); inputs[errors[0].index]?.focus(); return; }
      const account = /login|register|forgot|myinfo/.test(path) || !!form.closest('.opclogin,.opcregister,.opcforgot,.opcforgotpassword');
      formMessage(form, account ? '账号服务尚未配置。当前仅校验填写内容，未登录、注册或修改任何账号；验证码也不会发送。' : '表单信息校验通过，申请服务尚未接入。此次申请尚未提交或保存，请通过实际运营渠道联系。');
    };

    root.querySelectorAll<HTMLElement>(formSelector).forEach(form => {
      if (form instanceof HTMLFormElement) {
        const old = form.noValidate; form.noValidate = true; cleanups.push(() => { form.noValidate = old; });
      }
      form.querySelectorAll<HTMLInputElement>('input').forEach((input, index) => {
        input.id ||= `opc-field-${index}`;
        const label = input.closest('.form-group,.el-form-item')?.querySelector('label');
        if (label && !label.htmlFor) label.htmlFor = input.id;
        if (input.type === 'password') input.dataset.opcOriginalType = 'password';
      });
    });
    root.querySelectorAll<HTMLElement>('.password-toggle').forEach(button => {
      button.setAttribute('role', 'button'); button.tabIndex = 0; button.setAttribute('aria-label', '显示密码');
      button.dataset.opcAction = 'password';
    });
    root.querySelectorAll<HTMLElement>('.send-code-btn').forEach(button => { button.dataset.opcAction = 'send-code'; });
    root.querySelectorAll<HTMLElement>('.forgot-link').forEach(link => { link.dataset.opcRoute = '/opcforgotpassword'; });

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-opc-action],[data-opc-route],a[href],.password-toggle,.send-code-btn') : null;
      if (!target || !root.contains(target)) return;
      const action = target.dataset.opcAction;
      const value = target.dataset.opcValue ?? target.textContent?.trim() ?? '';
      if (action === 'filter-zone') {
        event.preventDefault(); const news = value === 'news';
        root.querySelectorAll<HTMLElement>('.community-section,.news-section').forEach(section => {
          const active = section.classList.contains('news-section') === news;
          section.hidden = !active; section.style.display = active ? '' : 'none';
        });
        root.querySelectorAll<HTMLElement>('[data-opc-action="filter-zone"]').forEach(button => {
          const active = button.dataset.opcValue === value; button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active));
        }); return;
      }
      if (action === 'image-preview') {
        event.preventDefault(); const src = safeContentUrl(value);
        if (src) { opener.current = target; setModal({ title: target.textContent?.trim() || '社区介绍', content: <img src={src} alt={target.textContent?.trim() || '社区介绍海报'} /> }); }
        return;
      }
      if (action?.startsWith('filter-')) {
        event.preventDefault(); filters.limit = PAGE_SIZE;
        if (action === 'filter-city') filters.city = value;
        else if (action === 'filter-market') filters.tab = value;
        else if (action === 'filter-gpu') {
          root.querySelectorAll<HTMLElement>('.price-item').forEach(item => { item.hidden = value !== 'all' && !item.textContent?.includes(value === 'monthly' ? '包月' : value === 'yearly' ? '包年' : '卡时'); });
          return;
        } else filters.category = value;
        renderLists(true); return;
      }
      if (action === 'load-more') { event.preventDefault(); filters.limit += PAGE_SIZE; renderLists(true); return; }
      if (action === 'course-detail') { event.preventDefault(); void showArticle(target.dataset.opcValue ?? target.closest<HTMLElement>('[data-opc-id]')?.dataset.opcId ?? '', target); return; }
      if (action === 'password' || action === 'toggle-password') {
        event.preventDefault(); const input = target.parentElement?.querySelector<HTMLInputElement>('input');
        if (input) { const visible = input.type === 'password'; input.type = visible ? 'text' : 'password'; target.setAttribute('aria-label', visible ? '隐藏密码' : '显示密码'); target.setAttribute('aria-pressed', String(visible)); target.classList.toggle('fa-eye-slash', visible); target.classList.toggle('fa-eye', !visible); } return;
      }
      if (action === 'send-code' || action === 'request-code') { event.preventDefault(); const form = target.closest<HTMLElement>(formSelector); if (form) formMessage(form, '短信验证服务尚未配置，未发送验证码。'); return; }
      if (action === 'form-submit') {
        // A role=form ancestor is also an action target. Editing a field must never submit it.
        const clickedButton = event.target instanceof Element ? event.target.closest('button,[type="submit"]') : null;
        if (!clickedButton) return;
        event.preventDefault(); const form = target.closest<HTMLElement>(formSelector); if (form) submitLocalForm(form); return;
      }
      if (action === 'work-platform') { event.preventDefault(); openInfo('工作平台', '工作平台的账号服务尚未配置，当前展示平台功能介绍。', target); return; }
      const candidate = target.dataset.opcRoute ?? (target instanceof HTMLAnchorElement ? target.getAttribute('href') : null);
      if (candidate && navigate(candidate)) { event.preventDefault(); return; }
      if (action === 'apply' || action === 'applycommunity') {
        // 加入/入驻类动作统一去原生申请入驻页（2026-10-23 需求），不再进
        // 登录克隆页 /opcapply。/apply 不在复刻路由表里，navigate() 会拒并
        // 放行默认行为——而这些卡是 article/div 无 href，默认行为是空操作，
        // 所以这里直接 router.push（本站原生路由，可信目标）。
        event.preventDefault(); router.push('/apply');
      }
    };

    const onSubmit = (event: SubmitEvent) => { if (event.target instanceof HTMLFormElement) { event.preventDefault(); submitLocalForm(event.target); } };
    const onInput = (event: Event) => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement)) return;
      if (input.matches('[data-opc-search],.hero-search-input')) { filters.query = input.value; filters.limit = PAGE_SIZE; renderLists(true); }
      if (input.type === 'tel') {
        input.closest(formSelector)?.querySelectorAll<HTMLButtonElement>('.send-code-btn').forEach(button => { button.disabled = !/^1[3-9]\d{9}$/.test(input.value.trim()); });
      }
      input.removeAttribute('aria-invalid'); input.classList.remove('opc-invalid');
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter' && event.target instanceof HTMLInputElement) {
        const form = event.target.closest<HTMLElement>(formSelector);
        if (form) { event.preventDefault(); submitLocalForm(form); return; }
      }
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.matches('[data-opc-action],[data-opc-route]') && !target.matches('a,button,input,textarea,select')) { event.preventDefault(); target.click(); }
    };
    const onPopState = () => { filters = readFilters(); root.querySelectorAll<HTMLInputElement>('[data-opc-search],.hero-search-input').forEach(input => { input.value = filters.query; }); renderLists(); };
    root.querySelectorAll<HTMLInputElement>('[data-opc-search],.hero-search-input').forEach(input => { input.value = filters.query; input.setAttribute('aria-label', input.getAttribute('placeholder') || '搜索内容'); });
    root.addEventListener('click', onClick); root.addEventListener('submit', onSubmit); root.addEventListener('input', onInput);
    root.addEventListener('keydown', onKeyDown); window.addEventListener('popstate', onPopState);

    cleanups.push(mountVisualMotion(root));

    renderLists();
    return () => {
      root.removeEventListener('click', onClick); root.removeEventListener('submit', onSubmit); root.removeEventListener('input', onInput);
      root.removeEventListener('keydown', onKeyDown); window.removeEventListener('popstate', onPopState);
      articleRequest.current?.abort(); setModal(null);
      root.querySelectorAll('[data-opc-generated]').forEach(node => node.remove()); cleanups.forEach(cleanup => cleanup());
    };
  }, [route, rootId, router]);

  if (!modal) return null;
  return (
    <dialog ref={dialog} className="opc-dialog" aria-labelledby="opc-dialog-title" onCancel={event => { event.preventDefault(); setModal(null); }} onClick={event => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) setModal(null); } }}>
      <div className="opc-dialog-header"><h2 id="opc-dialog-title">{modal.title}</h2><button type="button" className="opc-dialog-close" aria-label="关闭详情" onClick={() => setModal(null)}>×</button></div>
      <div className="opc-dialog-content" aria-busy={modal.loading || undefined}>{modal.content}</div>
      {modal.articleId && !modal.loading && <div className="opc-dialog-footer"><a href={`/opcapply?formType=training&courseId=${encodeURIComponent(modal.articleId)}`}>申请报名</a><a href={`/newsdetail?id=${encodeURIComponent(modal.articleId)}`}>打开完整详情</a></div>}
    </dialog>
  );
}
