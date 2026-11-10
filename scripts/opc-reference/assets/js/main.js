/* 集智 AI OPC 社区 · 官网交互 */
(function () {
  'use strict';

  /* ---------- 导航 ---------- */
  var nav = document.querySelector('.nav');
  var heroEl = document.querySelector('.hero');
  var navH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-h'), 10) || 74;
  if (nav && heroEl) nav.classList.add('nav--float');
  function onScroll() {
    if (!nav) return;
    /* 首屏封面页：透明导航浮在图上，滚过 banner 后转白底；
       其余页面没有 hero，始终保持白底。 */
    if (heroEl) {
      var past = window.scrollY > (heroEl.offsetHeight - navH - 12);
      nav.classList.toggle('nav--float', !past);
      nav.classList.toggle('is-solid', past);
    } else {
      nav.classList.toggle('is-solid', window.scrollY > 12);
    }
    var tt = document.querySelector('.totop');
    if (tt) tt.classList.toggle('on', window.scrollY > 700);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  onScroll();

  var burger = document.querySelector('.burger');
  var mnav = document.querySelector('.mnav');
  if (burger && mnav) {
    burger.addEventListener('click', function () {
      burger.classList.toggle('on');
      mnav.classList.toggle('on');
      document.body.style.overflow = mnav.classList.contains('on') ? 'hidden' : '';
    });
  }

  var totop = document.querySelector('.totop');
  if (totop) totop.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  /* ---------- 滚动进场（.rv → .vis） ---------- */
  var targets = document.querySelectorAll('.rv');
  if ('IntersectionObserver' in window && targets.length) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) {
          var el = e.target;
          var d = el.getAttribute('data-d') || 0;
          el.style.transitionDelay = (d * 70) + 'ms';
          el.classList.add('vis');
          io.unobserve(el);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    Array.prototype.forEach.call(targets, function (t) { io.observe(t); });
  } else {
    Array.prototype.forEach.call(targets, function (t) { t.classList.add('vis'); });
  }
  if (/noanim/.test(location.search)) {
    Array.prototype.forEach.call(document.querySelectorAll('.rv'), function (t) { t.classList.add('vis'); });
  }

  /* ---------- 数字滚动 ---------- */
  var nums = document.querySelectorAll('[data-count]');
  var NOANIM = /noanim/.test(location.search);
  if (NOANIM) {
    Array.prototype.forEach.call(nums, function (n) {
      var v = parseFloat(n.getAttribute('data-count'));
      var dec = parseInt(n.getAttribute('data-dec') || '0', 10);
      n.textContent = dec ? v.toFixed(dec) : Math.round(v).toLocaleString('en-US');
    });
  } else if (nums.length && 'IntersectionObserver' in window) {
    var io2 = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target;
        var to = parseFloat(el.getAttribute('data-count'));
        var dec = parseInt(el.getAttribute('data-dec') || '0', 10);
        var st = performance.now();
        var dur = 1200;
        function step(t) {
          var p = Math.min(1, (t - st) / dur);
          var v = to * (1 - Math.pow(1 - p, 3));
          el.textContent = dec ? v.toFixed(dec) : Math.round(v).toLocaleString('en-US');
          if (p < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
        io2.unobserve(el);
      });
    }, { threshold: 0.5 });
    Array.prototype.forEach.call(nums, function (n) { io2.observe(n); });
  }

  /* ---------- 动态列表：手风琴 ---------- */
  document.querySelectorAll('.nitem__hd').forEach(function (hd) {
    hd.addEventListener('click', function () {
      var it = hd.parentNode;
      var body = it.querySelector('.nitem__body');
      if (!body) return;
      var open = it.classList.contains('on');
      document.querySelectorAll('.nitem.on').forEach(function (o) {
        o.classList.remove('on');
        var b = o.querySelector('.nitem__body');
        if (b) b.style.maxHeight = '';
      });
      if (!open) it.classList.add('on');
    });
  });

  /* ---------- 动态分类筛选 ---------- */
  var nf = document.querySelectorAll('[data-news-filter]');
  if (nf.length) {
    nf.forEach(function (btn) {
      btn.addEventListener('click', function () {
        nf.forEach(function (b) { b.classList.remove('on'); });
        btn.classList.add('on');
        var k = btn.getAttribute('data-news-filter');
        document.querySelectorAll('[data-news-cat]').forEach(function (el) {
          el.style.display = (k === 'all' || el.getAttribute('data-news-cat') === k) ? '' : 'none';
        });
      });
    });
  }

  /* ---------- 智能体：分类 + 搜索 ---------- */
  var grid = document.getElementById('agentGrid');
  if (grid && window.AGENT_DATA) {
    var D = window.AGENT_DATA;
    var cur = 'all';
    var kw = '';
    var limit = 36;
    var chips = document.getElementById('agentChips');
    var countEl = document.getElementById('agentCount');
    var colors = ['#EAF3FD', '#EAF9F4', '#FDF1EA', '#F0EDFD', '#EAF6FD', '#FFF6E6'];

    function initials(name) {
      var s = (name || '?').replace(/[^\u4e00-\u9fa5A-Za-z0-9]/g, '');
      return s.slice(0, 1).toUpperCase();
    }
    function esc(s) {
      return String(s).replace(/[&<>"]/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
      });
    }
    function render() {
      var out = [];
      D.cats.forEach(function (c, ci) {
        if (cur !== 'all' && c.name !== cur) return;
        c.items.forEach(function (it, ii) {
          if (kw) {
            var hay = (it.n + it.d + c.name).toLowerCase();
            if (hay.indexOf(kw) < 0) return;
          }
          out.push({ it: it, cat: c.name, ci: ci, ii: ii });
        });
      });
      var all = out.length;
      var shown = out.slice(0, limit);
      if (!out.length) {
        grid.innerHTML = '<div class="empty" style="grid-column:1/-1">没有匹配的智能体，换个关键词试试</div>';
      } else {
        grid.innerHTML = shown.map(function (o) {
          var bg = colors[(o.ci + o.ii) % colors.length];
          return '<a class="acard" href="https://' + esc(o.it.u.replace(/^https?:\/\//, '')) +
            '" target="_blank" rel="noopener">' +
            '<div class="acard__top"><span class="acard__fav" style="background:' + bg + '">' +
            esc(initials(o.it.n)) + '</span><span class="acard__nm">' + esc(o.it.n) + '</span></div>' +
            '<p>' + esc(o.it.d) + '</p>' +
            '<span class="acard__url"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>' +
            esc(o.it.u) + '</span></a>';
        }).join('');
      }
      if (countEl) countEl.textContent = all;
      var mb = document.getElementById('agentMore');
      if (mb) {
        if (all > limit) {
          mb.style.display = '';
          mb.querySelector('span').textContent = '显示更多（还有 ' + (all - limit) + ' 个）';
        } else {
          mb.style.display = 'none';
        }
      }
    }
    if (chips) {
      chips.addEventListener('click', function (e) {
        var b = e.target.closest('.chip');
        if (!b) return;
        chips.querySelectorAll('.chip').forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on');
        cur = b.getAttribute('data-cat');
        limit = 36;
        render();
      });
    }
    var si = document.getElementById('agentSearch');
    if (si) {
      si.addEventListener('input', function () {
        kw = si.value.trim().toLowerCase();
        limit = 36;
        render();
      });
    }
    var mb = document.getElementById('agentMore');
    if (mb) mb.addEventListener('click', function () { limit += 36; render(); });
    render();
  }

  /* ---------- 入驻表单 ---------- */
  var form = document.getElementById('joinForm');
  if (form) {
    var ok = document.getElementById('joinOk');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var bad = false;
      form.querySelectorAll('[required]').forEach(function (f) {
        var fw = f.closest('.field') || f.closest('.checks');
        var v = (f.type === 'checkbox') ? f.checked : f.value.trim();
        if (!v) { bad = true; if (fw) fw.classList.add('bad'); }
        else { if (fw) fw.classList.remove('bad'); }
      });
      var tel = form.querySelector('[name=tel]');
      if (tel && tel.value.trim() && !/^1[3-9]\d{9}$/.test(tel.value.trim())) {
        bad = true;
        tel.closest('.field').classList.add('bad');
      }
      if (bad) return;
      var data = {};
      form.querySelectorAll('input,select,textarea').forEach(function (f) {
        if (!f.name) return;
        data[f.name] = f.type === 'checkbox' ? f.checked : f.value.trim();
      });
      data._time = new Date().toISOString();
      try {
        var all = JSON.parse(localStorage.getItem('jz_join') || '[]');
        all.push(data);
        localStorage.setItem('jz_join', JSON.stringify(all));
      } catch (err) { }
      form.style.display = 'none';
      if (ok) {
        ok.classList.add('on');
        ok.innerHTML = '✓ 已提交：' + (data.team || '') + '　我们将在 1 个工作日内与 ' + (data.contact || '您') + ' 联系。<br><span style="font-weight:600;color:#3F6E62">（当前为演示版本，表单数据仅保存在本机浏览器；接入后台后即转为正式提交。）</span>';
        ok.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
    form.querySelectorAll('input,select,textarea').forEach(function (f) {
      f.addEventListener('input', function () {
        var fw = f.closest('.field');
        if (fw) fw.classList.remove('bad');
      });
    });
  }

  /* ---------- 页内锚点跳转偏移已由 CSS scroll-padding 处理 ---------- */
})();
