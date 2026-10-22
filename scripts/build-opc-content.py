#!/usr/bin/env python3
"""Build inert, local OPC reference pages from the checked-in public capture.

The input is data, never executable JavaScript. This compiler uses a strict HTML
and CSS allowlist, resolves only public routes, and emits deterministic JSON.
Run again after updating scripts/opc-source/asset-map.json to localize media.
"""
from __future__ import annotations

import copy
import hashlib
import html
import json
import re
import sys
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urljoin, urlsplit, urldefrag

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "scripts/opc-source"
OUTPUT = ROOT / "src/lib/opc/generated"
BASE = "https://opcstore.com/webNew/index.html"
TAGS = set("a abbr article aside b blockquote br button caption circle code col colgroup dd defs del details div dl dt em figcaption figure footer form g h1 h2 h3 h4 h5 h6 header hr i img input label legend li line lineargradient main mark nav ol option p path polygon polyline pre rect section select small span stop strong sub summary sup svg table tbody td textarea th thead time tr u ul use".split())
VOID = {"br", "hr", "img", "input", "col"}
DROP = {"script", "style", "iframe", "object", "embed", "template", "noscript", "base", "link", "meta"}
ATTRS = set("id class title role tabindex alt width height viewbox preserveaspectratio d fill fill-rule clip-rule stroke stroke-width stroke-linecap stroke-linejoin points cx cy r x y x1 x2 y1 y2 rx ry opacity offset stop-color stop-opacity type name value placeholder required disabled checked selected multiple readonly min max minlength maxlength step autocomplete inputmode for colspan rowspan datetime open hidden loading decoding fetchpriority xmlns".split())
CSS = set("color background background-color font-size font-weight font-family font-style line-height letter-spacing text-align text-decoration vertical-align white-space word-break width min-width max-width height min-height max-height margin margin-top margin-right margin-bottom margin-left padding padding-top padding-right padding-bottom padding-left border border-top border-right border-bottom border-left border-radius border-color border-width border-style box-shadow text-shadow display visibility opacity overflow overflow-x overflow-y object-fit object-position transform transform-origin transition-delay animation-delay animation-duration animation-play-state position top right bottom left z-index flex flex-grow flex-shrink flex-basis align-items justify-content gap grid-template-columns aspect-ratio".split())
FORM_TYPES = {"community", "contact", "training", "star", "partner", "demand", "computing", "opc"}
QUERY_KEYS = {"id", "formType", "city", "tab", "category", "q", "page", "serverName", "serverCompute", "serverPrice", "rentalType"}
# 本站自有媒体（品牌标记 / 科技蓝主视觉）：来自 public/，不从原站下载，需在净化器中显式放行。
LOCAL_MEDIA = {"/logo-mark.svg", "/logo-mark-inverse.svg"} | {f"/opc/hero-{name}.svg" for name in ("grid", "flow", "orbit", "waves")}
VISUAL_ASSETS = {}
VISUAL_VARIANTS = {}
# 本站主站路由（不在复刻路由集 paths 里）：复刻页链接到主站页面时放行，
# 否则 safe_url 会按原站 BASE 把它们拼成绝对地址。
LOCAL_LINKS = {"/empower/space"}


@dataclass
class Node:
    tag: str = ""
    attrs: dict[str, str] = field(default_factory=dict)
    children: list["Node | str"] = field(default_factory=list)

    @property
    def classes(self):
        return set(self.attrs.get("class", "").split())

    @property
    def text(self):
        return "".join(c.text if isinstance(c, Node) else c for c in self.children).strip()


class TreeParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = Node()
        self.stack = [self.root]

    def handle_starttag(self, tag, attrs):
        node = Node(tag.lower(), {k.lower(): v or "" for k, v in attrs})
        self.stack[-1].children.append(node)
        if tag.lower() not in VOID:
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag.lower() not in VOID:
            self.stack.pop()

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i].tag == tag.lower():
                del self.stack[i:]
                return

    def handle_data(self, value):
        self.stack[-1].children.append(value)


def parse(value):
    parser = TreeParser()
    parser.feed(value)
    return parser.root


def walk(node):
    yield node
    for child in node.children:
        if isinstance(child, Node):
            yield from walk(child)


def by_class(node, name):
    return [n for n in walk(node) if name in n.classes]


def first(node, name):
    return next(iter(by_class(node, name)), None)


def set_text(node, name, value):
    target = first(node, name)
    if target:
        target.children = [str(value)]


def safe_style(value):
    output = []
    for declaration in value.split(";"):
        name, sep, content = declaration.partition(":")
        name, content = name.strip().lower(), content.strip()
        if not sep or not (name in CSS or re.fullmatch(r"--[a-z][a-z0-9-]{0,35}", name)):
            continue
        if not re.fullmatch(r"[\w\s#.,()%+\-/:]*", content, flags=re.ASCII):
            continue
        if re.search(r"url|expression|javascript|import|behavior|binding", content, re.I):
            continue
        content = re.sub(r"#ff8500(?=[0-9a-f]{2}\b|\b)", "#1d7fba", content, flags=re.I)
        content = re.sub(r"#(?:ff6b00|e67700)(?=[0-9a-f]{2}\b|\b)", "#0968ab", content, flags=re.I)
        content = re.sub(r"(rgba?)\(\s*255\s*,\s*133\s*,\s*0\s*([,)])", lambda m: f"{m[1]}(29,127,186{m[2]}", content, flags=re.I)
        output.append(f"{name}:{content}")
    return ";".join(output)


# ── 品牌替换 ────────────────────────────────────────────────────────────
# 原站运营方品牌「同橙」与站点名「OPC Store」必须整体换成本站品牌「集智AI」。
#
# 关键原则：**OPC 是业务概念词**（One Person Company / 一人公司），
# 与品牌名无关，**不得**被替换。只替换「同橙」与「OPC Store / OPCStore」。
#
# 规则按「长 → 短」排列，先命中更具体的组合，避免「同橙」先被吃掉
# 导致「同橙OPC社区」被拆成不一致的碎片结果。
# 覆盖情况由 scripts/opc-brand-audit.mjs 实测统计并可复跑复核。

# 本站自身的站点信息 —— 与 `src/lib/site/config.ts` 的 `site` 常量保持一致。
# 2026-10-22 业务方已提供电话 / 邮箱 / 地址 / 域名，因此联系位照常渲染。
# ⚠️ **备案号业务方未提供**，所以页脚与关于页一律不渲染备案号 ——
# 原运营方的「苏ICP备2026012874号」已整项删除，不顶替、不编造。
SITE_URL = "https://www.jizhiai.net.cn"
SITE_DOMAIN = "www.jizhiai.net.cn"
SITE_ADDRESS = "北京市丰台区西马场甲14号"
SITE_PHONE = "400-006-5858"
SITE_EMAIL = "developer@jimei.com.cn"

# 原运营方（同橙）的联系信息。这些值出现在页脚「联系我们」与备案行里，
# 它们属于**同橙的公司身份**，不是本站的。
OPERATOR_CONTACT_TOKENS = ("025-86551126", "hr@tongcheng.ai")
OPERATOR_ADDRESS = "南京市鼓楼区古平岗4号"
OPERATOR_ADDRESS_LONG = "南京市鼓楼区古平岗4号智梦园B座"
OPERATOR_ICP = "苏ICP备2026012874号"

BRAND_RULES = [
    # 站名口径以《集智AI 网站.docx》为准：「集智 AI OPC 社区」（主站 config.name 同源）。
    # 原映射目标带的「平台」后缀与无空格写法均与 Word 口径不一致，统一收敛。
    ("同橙OPC社区平台", "集智 AI OPC 社区"),
    ("同橙 OPC 社区平台", "集智 AI OPC 社区"),
    ("同橙OPC社区", "集智 AI OPC 社区"),
    ("同橙 OPC 社区", "集智 AI OPC 社区"),
    ("同橙OPC", "集智 AI OPC"),
    ("同橙 AI 学院", "集智AI 学院"),
    ("同橙AI学院", "集智AI学院"),
    ("同橙科创产业发展集团", "集智AI 产业发展集团"),
    ("同橙科创产业板块", "集智AI 产业板块"),
    ("同橙", "集智AI"),
    ("OPC Store", "集智AI"),
    ("OPCStore", "集智AI"),
    # 原站域名（tongcc = 同橙）。页面文字与 href 都要换，
    # 否则「联系我们」里的链接会把访客带回原站。
    # 原运营方的邮箱域名（tongcheng.ai）→ 本站域名。
    # 文章正文里的「邮箱：opc@tongcheng.ai」是联系信息，
    # 品牌已整体换成集智AI，域名必须一起换，否则自相矛盾。
    ("tongcheng.ai", SITE_DOMAIN),
    # 原运营方总部地址（长 → 短，避免留下「…智梦园B座」这种拼接残渣）
    ("南京市鼓楼区古平岗4号智梦园B座", SITE_ADDRESS),
    ("南京市鼓楼区古平岗4号", SITE_ADDRESS),
    ("https://www.tongcc.com", SITE_URL),
    ("http://www.tongcc.com", SITE_URL),
    ("www.tongcc.com", SITE_DOMAIN),
    ("tongcc.com", SITE_DOMAIN),
    # 原运营方的另一个站点域名：页脚「联系我们」的链接与关于页「集团官网」
    # 都在用它，同样属于原运营方资产 → 换成本站域名。
    ("https://t.3cool.cc", SITE_URL),
    ("http://t.3cool.cc", SITE_URL),
    ("t.3cool.cc", SITE_DOMAIN),
    # 「算力超市」外链：原站指向 ai.opcstore.com → 本站。
    # ⚠️ **先消化城市子域名再匹配本条**：`shanghai.opcstore.com` 里含有
    # `ai.opcstore.com` 子串（shang·HAI.OPC·store…），直排替换会把它撕成
    # `shangth.jimei.cn` 这种残链（社区页「上海」入口实测中招）。
    # 页面上的城市入口链接由 `localize_operator_links()` 归位到 `/zone?city=…`，
    # 这里兜底处理散落在正文文字里的城市域名引用。
    ("https://shanghai.opcstore.com", SITE_URL),
    ("shanghai.opcstore.com", SITE_DOMAIN),
    ("https://nanjing.opcstore.com", SITE_URL),
    ("nanjing.opcstore.com", SITE_DOMAIN),
    ("https://ai.opcstore.com", "https://th.jimei.cn"),
    ("http://ai.opcstore.com", "https://th.jimei.cn"),
    ("ai.opcstore.com", "th.jimei.cn"),
]

# 需要品牌替换的标记（`rebrand()` 的短路条件）
BRAND_MARKERS = (
    "同橙", "OPC Store", "OPCStore", "tongcc", "tongcheng",
    "南京市鼓楼区古平岗4号", "t.3cool.cc", "ai.opcstore.com",
    "nanjing.opcstore.com", "shanghai.opcstore.com",
)

# 媒体地址属性：不做品牌替换（见 rebrand_tree 的说明）
MEDIA_URL_ATTRS = {"src", "srcset", "poster", "data-src", "data-original"}


def rebrand(text):
    """Replace the reference operator brand with this site's brand."""
    if not text or not any(marker in text for marker in BRAND_MARKERS):
        return text
    for source, target in BRAND_RULES:
        if source in text:
            text = text.replace(source, target)
    return text


def rebrand_tree(node):
    """Apply the brand mapping to every text node and to brand-bearing attributes.

    属性同样需要替换：原站把品牌名写进了 `alt="同橙AI"`、`data-opc-category="同橙OPC社区"`
    这类属性值里，只改文本节点会留下可见的品牌残留（alt 会作为无障碍名称读出来）。
    """
    for current in walk(node):
        current.children = [rebrand(child) if isinstance(child, str) else child for child in current.children]
        for key, value in list(current.attrs.items()):
            # ⚠️ **媒体 URL 不做品牌替换** —— 图片的原始地址就在原站域名下
            # （`asset-map.json` 的键是 `https://www.tongcc.com/uploads/...`），
            # 品牌规则若先改了 src，本地化就查不到映射，图片会变成指向
            # 本站不存在路径的远程链接（实测 `t.3cool.cc/uploads/...`）。
            # 媒体地址由 sanitize() 统一改写成本地素材路径。
            if key in MEDIA_URL_ATTRS:
                continue
            if isinstance(value, str) and any(marker in value for marker in BRAND_MARKERS):
                current.attrs[key] = rebrand(value)
    return node


def rebrand_tree_deep(value):
    """Apply the brand mapping to a plain JSON structure (strings, lists, dicts)."""
    if isinstance(value, str):
        return rebrand(value)
    if isinstance(value, list):
        return [rebrand_tree_deep(item) for item in value]
    if isinstance(value, dict):
        return {key: rebrand_tree_deep(item) for key, item in value.items()}
    return value


def remove_matching(node, predicate):
    """递归删除满足 predicate 的子节点。

    `Node` 不持有 parent 引用，因此用「自顶向下重写 children」的方式删除。
    """
    kept = []
    for child in node.children:
        if isinstance(child, Node):
            if predicate(child):
                continue
            remove_matching(child, predicate)
        kept.append(child)
    node.children = kept
    return node


def remove_header_login(node):
    """删除页头右上角的登录入口。

    · 桌面端：导航链接里的 `li.loginli`（「登录」文字链）
    · 移动端：`.user-area` 容器（里面只有一枚 el-button 造型的登录按钮）

    ⚠️ 只删页头这两处 —— `/opclogin` 表单里的**提交按钮**也叫 `login-btn`
    （无 `el-button` 类、不带 data-opc-action），不能误伤；登录 / 注册 /
    忘记密码三页之间的文字互链（「立即登录」「返回登录」等）也全部保留。
    本站暂无登录能力，先撤页头入口；`/opclogin` 路由本身保留。
    """
    remove_matching(
        node,
        lambda n: (n.tag == "li" and "loginli" in n.classes) or "user-area" in n.classes,
    )


def localize_operator_links(node, cities):
    """把页面上指向原运营方线上资产的链接改指到本站对应页。

    · 城市入口（原 `nanjing.opcstore.com`，以及被域名替换误伤成
      `shang*h.jimei.cn` 的上海入口）→ 本站 `/zone?city=城市`
    · 原站论坛（`opcstore.com/bbs`，「社区交流」页签）→ 本站 `/community`
    · 其余仍指向 opcstore.com 的绝对链接 → **去链接保文字**（本站无对应页，
      不能把访客送去原运营方的线上站点）
    · `th.jimei.cn`（算力超市，本站自有域名）与第三方工具目录链接不动。

    判定依据是锚文本：城市名只在区域入口上做链接文本出现，
    导航项（算力超市等）与正文引用不会撞上。
    """
    for current in list(walk(node)):
        kept = []
        for child in current.children:
            if isinstance(child, Node) and child.tag == "a":
                href = child.attrs.get("href", "")
                label = re.sub(r"\s+", "", child.text)
                if urlsplit(href).hostname == "ai.opcstore.com":
                    child.attrs.update(href="https://th.jimei.cn", target="_blank")
                elif "opcstore.com" in href and "/bbs" in href:
                    child.attrs["href"] = "/community"
                    child.attrs.pop("target", None)
                    child.attrs.pop("rel", None)
                elif href.startswith("http") and label in cities and urlsplit(href).netloc not in {"th.jimei.cn"}:
                    child.attrs["href"] = "/zone?city=" + label
                    child.attrs.pop("target", None)
                    child.attrs.pop("rel", None)
                elif "opcstore.com" in href:
                    kept.extend(child.children)
                    continue
            kept.append(child)
        current.children = kept


def replace_operator_contact(node):
    """把页脚「联系我们」里的原运营方身份信息换成本站信息。

    ⚠️ 电话 / 邮箱 / 备案号：**整条删除**，不拿原站信息顶替 ——
    本站尚未取得这些信息（`src/lib/site/config.ts` 的 `site.contact` 为空，
    注释里写明「不得臆造」），而以集智AI 名义展示同橙的电话与备案号属于误导。
    业务方补齐后由主站页脚渲染。

    地址换成本站地址；域名由 `rebrand()` 的规则换成本站域名。
    """
    # 先把元素列表固化下来，避免边遍历边改 children 漏掉节点
    for current in list(walk(node)):
        kept = []
        for child in current.children:
            if isinstance(child, Node):
                if child.tag == "li" and any(
                    token in child.text for token in OPERATOR_CONTACT_TOKENS
                ):
                    continue
                if child.tag == "a" and OPERATOR_ICP in child.text:
                    continue
            kept.append(child)
        current.children = kept

    # 本站自己的联系卡（申请页 `.contact-item`）：
    # 电话与邮箱业务方未提供 → **整项删除**（与主站页脚「有值才渲染」一致），
    # 不用原站信息顶替，也不编造本站邮箱。
    # ⚠️ 必须在 `rebrand_tree()` **之前**执行 —— 否则邮箱域名先被换成本站域名，
    # 这里就认不出「这是原运营方的邮箱」了。
    remove_matching(
        node,
        lambda n: "contact-item" in n.classes
        and any(token in n.text for token in OPERATOR_CONTACT_TOKENS),
    )

    # 地址替换**只限本站自己的联系位** —— 文章正文里提到原运营方的地址是历史事实，
    # 不该被改成本站地址。
    for footer in by_class(node, "opcbottom") or by_class(node, "footer-item"):
        for current in list(walk(footer)):
            current.children = [
                # ⚠️ 长串先替换 —— 否则「…古平岗4号」先命中，
                # 会留下「北京市丰台区大红门智梦园B座」这种拼接残渣。
                child.replace(OPERATOR_ADDRESS_LONG, SITE_ADDRESS).replace(OPERATOR_ADDRESS, SITE_ADDRESS)
                if isinstance(child, str) else child
                for child in current.children
            ]
    for block in by_class(node, "contact-details"):
        for current in list(walk(block)):
            current.children = [
                # ⚠️ 长串先替换 —— 否则「…古平岗4号」先命中，
                # 会留下「北京市丰台区大红门智梦园B座」这种拼接残渣。
                child.replace(OPERATOR_ADDRESS_LONG, SITE_ADDRESS).replace(OPERATOR_ADDRESS, SITE_ADDRESS)
                if isinstance(child, str) else child
                for child in current.children
            ]
    return node


def _clone_with(node, icon=None, title=None, value=None, href=None):
    """深拷贝一个参考节点，并按需替换图标 / 标题 / 值 / 链接。

    ⚠️ 必须**克隆**而不是手写新节点：原站 CSS 的选择器带
    `data-v-<scope>` 属性限定（如 `.contact-item[data-v-010c94e4]`），
    手写节点缺这个属性 → 选择器不匹配 → **整块样式失效**
    （实测：关于页新插入的「联系电话」没有卡片框、图标块，样式全丢）。

    克隆同时保证了结构与 scope 属性与同级节点完全一致。
    """
    clone = copy.deepcopy(node)
    if icon:
        for n in walk(clone):
            if n.tag == "i":
                n.attrs["class"] = icon
                break
    if title:
        for n in walk(clone):
            if n.tag == "h4":
                n.children = [title]
                break
    if value is not None:
        # 三种承载形态，按优先级取一种，避免文字重复：
        #   <p>值</p>（关于页 contact-item） → 直接子文本（页脚地址那条）
        #   → <a>文本</a>（页脚域名那条，由 href 分支负责）
        replaced = False
        for n in walk(clone):
            if n.tag == "p":
                n.children = [value]
                replaced = True
                break
        if not replaced and not any(n.tag == "a" for n in walk(clone)):
            clone.children = [c for c in clone.children if not isinstance(c, str)] + [value]
    if href:
        for n in walk(clone):
            if n.tag == "a":
                n.attrs["href"] = href
                n.children = [value if value is not None else n.text]
                break
    return clone


def inject_site_contact(tree):
    """把本站的电话与邮箱写进联系位（原运营方的对应项已整项删除）。

    业务方 2026-10-22 提供：
      电话 400-006-5858 / 邮箱 developer@jimei.com.cn
    备案号**未提供** → 一律不渲染（原运营方的「苏ICP备2026012874号」已删除，
    不顶替、不编造）。
    """
    # 页脚「联系我们」：<div class="footer-item"> 里的 <ul>
    for item in by_class(tree, "footer-item"):
        heading = next((n for n in walk(item) if n.tag == "h4"), None)
        if heading is None or "联系我们" not in heading.text:
            continue
        ul = next((n for n in walk(item) if n.tag == "ul"), None)
        if ul is None:
            continue
        rows = [n for n in walk(ul) if n.tag == "li"]
        if any(SITE_PHONE in row.text for row in rows):
            continue
        # 纯文本条目（地址那条）当电话模板，带 <a> 的条目（域名那条）当邮箱模板
        plain = next((r for r in rows if not any(n.tag == "a" for n in walk(r))), None)
        linked = next((r for r in rows if any(n.tag == "a" for n in walk(r))), None)
        additions = []
        if plain is not None:
            additions.append(_clone_with(plain, icon="fas fa-phone", value=f" {SITE_PHONE}"))
        if linked is not None:
            additions.append(
                _clone_with(linked, icon="fas fa-envelope", value=SITE_EMAIL,
                            href=f"mailto:{SITE_EMAIL}")
            )
        if additions:
            ul.children = list(ul.children) + additions

    # 关于页「联系我们」：<div class="contact-info"> 里的 .contact-item
    for info in by_class(tree, "contact-info"):
        cards = [n for n in walk(info) if n.tag == "div" and "contact-item" in n.classes]
        if any(SITE_PHONE in card.text for card in cards):
            continue
        if not cards:
            continue
        info.children = list(info.children) + [
            _clone_with(cards[0], icon="fas fa-phone", title="联系电话", value=SITE_PHONE),
            _clone_with(cards[0], icon="fas fa-envelope", title="商务邮箱", value=SITE_EMAIL),
        ]
    return tree


def inject_brand_mark(tree):
    """Replace the text-only site logo with the 集智AI brand mark.

    原站 logo 是一段纯文字（「OPC Store」），与本站的品牌图形不一致。
    这里在 `.logo` 容器内插入 `public/logo-mark.svg` 的 `<img>`，
    保留原有 `<a>` 的 href 与可访问名（`alt` 留空，名称由相邻文字提供）。

    深底反白版通过 CSS 切换（首页页头浮在深色主视觉上），
    因此两张图都注入，用 `data-opc-mark` 区分。
    """
    for logo in by_class(tree, "logo"):
        anchor = next((n for n in walk(logo) if n.tag == "a"), None)
        if anchor is None:
            continue
        # 已有标记则不重复注入
        if any(n.tag == "img" for n in walk(logo)):
            continue
        anchor.children = [
            Node("img", {"class": "opc-brand-mark", "src": "/logo-mark.svg", "alt": "", "loading": "eager", "decoding": "async", "data-opc-mark": "light"}),
            Node("img", {"class": "opc-brand-mark opc-brand-mark--inverse", "src": "/logo-mark-inverse.svg", "alt": "", "loading": "eager", "decoding": "async", "data-opc-mark": "dark"}),
        ] + [n for n in anchor.children if isinstance(n, Node) and n.tag == "span"]
    return tree


def beijing_home_region(node):
    """社区页的区域入口以本站主场城市「北京」领衔。

    原站首城是运营方所在的南京；本站实体社区在北京丰台
    （《集智AI 网站.docx》：首期 3000+ 平米）。区域入口与说明文案随之改写，
    「北京」入口指向主站的集智空间页（/empower/space）。
    ⚠️ 只动区域入口与说明行 —— 城市筛选 chips 与新闻列表**不改**：
    那是按城市归档的资讯数据（「政策资讯·南京」等真实报道），
    改名会让筛选落空、也会篡改资讯事实。
    """
    for current in walk(node):
        if "community-sub" in current.classes:
            current.children = [
                child.replace("南京 / 上海", "北京 / 上海") if isinstance(child, str) else child
                for child in current.children
            ]
    for link in by_class(node, "oc-region--link"):
        if re.sub(r"\s+", "", link.text) == "南京":
            link.attrs["href"] = "/empower/space"
            link.attrs.pop("target", None)
            link.attrs.pop("rel", None)
            for current in walk(link):
                current.children = [
                    child.replace("南京", "北京") if isinstance(child, str) else child
                    for child in current.children
                ]


def replace_home_hero(tree):
    """Keep the reference carousel structure; use local, responsive brand imagery."""
    if not by_class(tree, "hero"):
        return tree
    hero_variants = ["hero-city-12", "hero-city-11", "hero-city-13", "computing-banner"]
    carousel_images = []
    for carousel in by_class(tree, "hero-carousel"):
        for item in by_class(carousel, "el-carousel__item"):
            image = next((n for n in walk(item) if n.tag == "img"), None)
            if image is not None:
                carousel_images.append(image)
    for index, image in enumerate(carousel_images[:len(hero_variants)]):
        image.attrs.update(visual_image(hero_variants[index], decorative=True, first=index == 0, sizes="100vw").attrs)
    # hero 区原站 logo 图 → 集智AI 品牌标记
    for logo_node in by_class(tree, "hero-logo"):
        image = next((n for n in walk(logo_node) if n.tag == "img"), None)
        if image is not None:
            image.attrs["src"] = "/logo-mark-inverse.svg"
            image.attrs["alt"] = ""
            image.attrs["loading"] = "eager"
    return tree


def load_visual_media():
    """Exact, verified public paths only. Validation happens once at build time."""
    manifest = json.loads((SOURCE / "visual-media.json").read_text())
    LOCAL_MEDIA.difference_update(VISUAL_VARIANTS)
    VISUAL_ASSETS.clear()
    VISUAL_VARIANTS.clear()
    if manifest.get("schemaVersion") != 1:
        raise ValueError("Unsupported visual media manifest")
    visual_root = (ROOT / "public/opc/visual").resolve()
    for asset in manifest["assets"]:
        if asset["id"] in VISUAL_ASSETS:
            raise ValueError("Duplicate visual asset: " + asset["id"])
        VISUAL_ASSETS[asset["id"]] = asset
        for variant in asset["variants"]:
            url = variant["url"]
            if not re.fullmatch(r"/opc/visual/[a-z0-9]+(?:-[a-z0-9]+)*\.(?:webp|svg)", url):
                raise ValueError("Invalid visual URL: " + url)
            path = (ROOT / "public" / url.lstrip("/")).resolve(strict=True)
            if path.parent != visual_root or not path.is_file():
                raise ValueError("Visual media outside public directory: " + url)
            if url in VISUAL_VARIANTS or not all(isinstance(variant[k], int) and variant[k] > 0 for k in ("width", "height", "bytes")):
                raise ValueError("Invalid visual metadata: " + url)
            content = path.read_bytes()
            if len(content) != variant["bytes"] or hashlib.sha256(content).hexdigest() != variant["sha256"]:
                raise ValueError("Visual media changed; run opc:media: " + url)
            VISUAL_VARIANTS[url] = variant
    LOCAL_MEDIA.update(VISUAL_VARIANTS)


def visual_image(asset_id, *, decorative=False, first=False, sizes="(max-width: 767px) 100vw, 33vw", class_name=""):
    asset = VISUAL_ASSETS[asset_id]
    variants = sorted(asset["variants"], key=lambda v: v["width"])
    largest = variants[-1]
    attrs = {"src": largest["url"], "width": str(largest["width"]), "height": str(largest["height"]), "alt": "" if decorative else asset["alt"], "loading": "eager" if first else "lazy", "decoding": "async", "fetchpriority": "high" if first else "auto"}
    if len(variants) > 1:
        attrs.update(srcset=", ".join(f'{v["url"]} {v["width"]}w' for v in variants), sizes=sizes)
    if class_name:
        attrs["class"] = class_name
    return Node("img", attrs)


def safe_srcset(value):
    """A width descriptor must match a verified local derivative's actual width."""
    candidates, widths = [], set()
    for candidate in value.split(","):
        match = re.fullmatch(r"\s*(/opc/visual/[a-z0-9-]+\.(?:webp|svg))\s+([1-9]\d*)w\s*", candidate)
        if not match:
            return ""
        url, width = match[1], int(match[2])
        if url not in VISUAL_VARIANTS or VISUAL_VARIANTS[url]["width"] != width or width in widths:
            return ""
        widths.add(width)
        candidates.append(f"{url} {width}w")
    return ", ".join(candidates)


def insert_before_class(tree, class_name, addition):
    for parent in walk(tree):
        for index, child in enumerate(parent.children):
            if isinstance(child, Node) and class_name in child.classes:
                parent.children.insert(index, addition)
                return
    raise ValueError("Missing visual insertion target: " + class_name)


def visual_gallery(kind, title, description, items):
    cards = []
    for asset_id, tag, caption in items:
        cards.append(Node("figure", {"class": "opc-visual-photo-card"}, [
            Node("div", {"class": "opc-visual-photo-media"}, [visual_image(asset_id)]),
            Node("figcaption", {}, [Node("span", {"class": "opc-visual-photo-tag"}, [tag]), Node("h3", {}, [caption])]),
        ]))
    return Node("section", {"class": "section opc-visual-gallery", "data-opc-gallery": kind}, [Node("div", {"class": "container"}, [
        Node("div", {"class": "sec-head opc-visual-section-head"}, [Node("span", {"class": "sec-eyebrow"}, ["LEARN · CONNECT · CREATE"]), Node("h2", {}, [title]), Node("p", {}, [description])]),
        Node("div", {"class": "opc-visual-photo-grid"}, cards),
    ])])


def visual_ecosystem():
    return Node("section", {"class": "section opc-visual-ecosystem"}, [Node("div", {"class": "container"}, [
        Node("div", {"class": "sec-head opc-visual-section-head"}, [Node("span", {"class": "sec-eyebrow"}, ["AI ECOSYSTEM"]), Node("h2", {}, ["AI生态"]), Node("p", {}, ["关注模型、工具、产业与教育，让多元视角连接 AI 应用。"])]),
        Node("ul", {"class": "opc-visual-logo-grid", "aria-label": "AI生态标识"}, [Node("li", {"class": "opc-visual-logo-card"}, [visual_image(f"logo-{index:02}")]) for index in range(1, 13)]),
    ])])


def inject_visual_media(tree, path):
    training = [("activity-training-1", "技能实训", "在实践中理解 AI"), ("activity-training-2", "主题分享", "从方法到应用"), ("activity-training-3", "交流共创", "让想法相互启发")]
    if path == "/":
        replace_home_hero(tree)
        icons = ["agent", "market", "academy", "star", "community", "work", "computing", "gpu"]
        for feature, icon in zip(by_class(tree, "ftr-node"), icons):
            core = first(feature, "ftr-hub-core")
            if core:
                core.children = [visual_image("icon-" + icon, decorative=True, class_name="opc-visual-service-icon")]
        learning = [("activity-ai-drama", "AI内容创作", "一起探索 AI 漫剧")] + training + [("activity-study-unitree", "产业研学", "走近机器人应用"), ("activity-study-brainco", "技术交流", "看见新的应用可能")]
        insert_before_class(tree, "news-sec", visual_gallery("learning", "学习与交流", "从课堂实训到产业研学，在真实的交流中拓展 AI 视野。", learning))
        insert_before_class(tree, "cta-sec", visual_ecosystem())
    elif path == "/center":
        insert_before_class(tree, "path-sec", visual_gallery("academy", "在实践中学习", "把方法带进课堂，把想法带入创作与交流。", training))
    elif path in {"/about", "/community"}:
        scene = visual_gallery("scene", "实践与共创", "学习、分享与协作，让 AI 创作走进日常。", [training[0], training[2]])
        insert_before_class(tree, "contact-section" if path == "/about" else "join-section", scene)
    elif path == "/work":
        for parent in walk(tree):
            for index, child in enumerate(parent.children):
                if isinstance(child, Node) and "partners-section" in child.classes:
                    parent.children[index] = visual_ecosystem()
    hero_classes = {"/agent": "hero-agent", "/market": "hero-market", "/center": "hero-center", "/starproject": "hero-sp", "/nanjingzone": "njz-hero", "/work": "hero", "/computingresource": "hero"}
    hero = first(tree, hero_classes.get(path, "page-header")) if path != "/" else None
    if hero:
        dark = path in {"/work", "/computingresource"}
        hero.attrs["class"] = hero.attrs.get("class", "") + " opc-visual-hero has-visual" + (" has-visual-dark" if dark else "")
        asset_id = "computing-banner" if dark else "hero-city-13" if path == "/market" else "hero-city-11" if path == "/agent" else "hero-city-12"
        hero.children.insert(0, Node("div", {"class": "opc-visual-hero-art", "aria-hidden": "true"}, [visual_image(asset_id, decorative=True, sizes="(max-width: 767px) 100vw, 48vw", class_name="opc-visual-hero-image")]))
    return tree


def local_location(raw, paths):
    raw = html.unescape(raw).strip()
    if re.search(r"[\x00-\x20\\]", raw):
        return None
    if raw.startswith("#/"):
        raw = raw[1:]
    parsed = urlsplit(urljoin(BASE, raw))
    if parsed.hostname not in {"opcstore.com", "www.opcstore.com"} or parsed.scheme not in {"http", "https"} or parsed.username or parsed.password or parsed.port:
        return None
    target = parsed.fragment if parsed.fragment.startswith("/") else parsed.path
    if target.startswith("/webNew/") or target == "/webNew":
        target = "/"
    target_parts = urlsplit(target)
    path = target_parts.path.lower().rstrip("/") or "/"
    path = {"/opc": "/", "/star": "/starproject"}.get(path, path)
    if path not in paths:
        return None
    query = dict(parse_qsl(target_parts.query or parsed.query, keep_blank_values=False))
    query = {k: v[:300] for k, v in query.items() if k in QUERY_KEYS}
    if "formType" in query and query["formType"] not in FORM_TYPES:
        query.pop("formType")
    return path + ("?" + urlencode(query) if query else "")


def safe_url(raw, *, media=False, paths=None, assets=None):
    raw = html.unescape(raw).strip()
    if not raw or re.search(r"[\x00-\x20\\]", raw):
        return ""
    # 本站自有的品牌标记由 public/ 提供，不来自原站，必须显式放行。
    # 只允许这两个精确路径，避免任意本地路径从源 HTML 穿透。
    if raw in LOCAL_MEDIA:
        return raw
    if raw.startswith("/opc/visual/"):
        # A misspelled / unverified derivative must not turn into a source-site URL.
        return ""
    if not media and raw in LOCAL_LINKS:
        return raw
    if not media and raw.startswith("#") and not raw.startswith("#/"):
        return raw if re.fullmatch(r"#[A-Za-z][\w:.-]*", raw) else ""
    if not media and paths:
        local = local_location(raw, paths)
        if local:
            return local
    absolute = urljoin(BASE, raw)
    if media:
        absolute = urldefrag(absolute)[0]
    p = urlsplit(absolute)
    if p.username or p.password:
        return ""
    if p.scheme not in ({"http", "https"} if media else {"http", "https", "mailto", "tel"}):
        return ""
    return (assets or {}).get(absolute, absolute)


def sanitize(node, paths, assets):
    if node.tag in DROP:
        return ""
    body = "".join(sanitize(c, paths, assets) if isinstance(c, Node) else html.escape(c) for c in node.children)
    if not node.tag or node.tag not in TAGS:
        return body
    attrs = {}
    for key, value in node.attrs.items():
        if key.startswith("on"):
            continue
        if key == "srcset" and node.tag == "img":
            clean = safe_srcset(value)
            if clean:
                attrs[key] = clean
        elif key == "sizes" and node.tag == "img":
            if "srcset" in node.attrs and safe_srcset(node.attrs["srcset"]) and re.fullmatch(r"[\w\s().,:-]+", value):
                attrs[key] = value
        elif key in {"href", "xlink:href", "src"}:
            if key in {"href", "xlink:href"} and node.tag == "use":
                clean = value if re.fullmatch(r"#[A-Za-z][\w:.-]*", value) else ""
            else:
                clean = safe_url(value, media=key == "src", paths=paths, assets=assets)
            if clean:
                attrs[key] = clean
        elif key == "style":
            clean = safe_style(value)
            if clean:
                attrs[key] = clean
        elif key == "data-opc-route":
            clean = local_location(value, paths)
            if clean:
                attrs[key] = clean
        elif key == "data-opc-value" and node.attrs.get("data-opc-action") == "image-preview":
            clean = safe_url(value, media=True, paths=paths, assets=assets)
            if clean:
                attrs[key] = clean
        elif key in {"fill", "stroke", "stop-color"}:
            attrs[key] = re.sub(r"#ff8500\b", "#1d7fba", value, flags=re.I)
        elif key in ATTRS or re.fullmatch(r"(?:data-v-[a-z0-9]+|data-opc-[a-z-]+|aria-[a-z-]+)", key):
            attrs[key] = value
        elif key == "target" and value == "_blank":
            attrs[key] = value
    if node.tag == "a" and attrs.get("target") == "_blank":
        attrs["rel"] = "noopener noreferrer"
    if node.tag == "form":
        attrs["role"] = "form"
        attrs["data-opc-action"] = "form-submit"
    if node.tag == "button":
        attrs["type"] = "button"
    if node.tag == "img":
        # 原站文章图把图床 URL 写进了 alt（无障碍朗读会整串念出来），
        # 纯 URL 不是替代文本 —— 置空。
        if re.match(r"https?://", str(attrs.get("alt", "")).strip()):
            attrs["alt"] = ""
        attrs.setdefault("alt", "")
        attrs.setdefault("loading", "lazy")
        attrs["decoding"] = "async"
    encoded = "".join(f' {k}="{html.escape(str(v), quote=True)}"' for k, v in attrs.items())
    tag = "div" if node.tag == "form" else node.tag
    return f"<{tag}{encoded}>" + ("" if tag in VOID else body + f"</{tag}>")


def action(node, name, value="", route=""):
    node.attrs["data-opc-action"] = name
    if value:
        node.attrs["data-opc-value"] = str(value)
    if route:
        node.attrs["data-opc-route"] = route
    if node.tag not in {"a", "button", "input", "select", "textarea"}:
        node.attrs.update(role="button", tabindex="0")


def sub(record, sort):
    return next((x["content"] for x in record.get("subtitle_list", []) if x["sort"] == sort), "")


def date_for(record):
    stamp = sub(record, -2)
    if stamp and not stamp.isdigit():
        return stamp[:10]
    return datetime.fromtimestamp(int(stamp or record["create_time"]), tz=timezone(timedelta(hours=8))).strftime("%Y-%m-%d")


def card_id(node, records):
    explicit = node.attrs.get("data-opc-id")
    if explicit and any(str(x["id"]) == explicit for x in records):
        return int(explicit)
    text = node.text
    return next((x["id"] for x in sorted(records, key=lambda item: -len(item["title"].strip())) if x["title"].strip() in text), None)


def enhance(root, path, records, directory):
    category = {"/": 10, "/newslist": 10, "/activitylist": 16, "/starproject": 16, "/market": 14, "/center": 15, "/community": 17, "/zone": 17}.get(path)
    matching_records = [r for r in records if category is None or r["category_id"] == category]
    first_hero = next((node for node in walk(root) if node.tag == "img"), None) if path == "/" else None
    if first_hero:
        first_hero.attrs.update(loading="eager", fetchpriority="high")
    if path == "/":
        for node, value in zip(by_class(root, "hero-stat-num"), ["500+", "1,000+", "200+", "50+"]):
            node.children = [value]
        features = json.loads((SOURCE / "home-features.json").read_text())
        for node in by_class(root, "ftr-node"):
            label = first(node, "ftr-tag")
            feature = next((item for item in features if label and item["title"] == label.text), None)
            if feature:
                node.tag = "a"
                if feature["page"] == "computing":
                    node.attrs.update(href="https://ai.opcstore.com", target="_blank")
                else:
                    node.attrs["href"] = "/" + feature["page"]
    for node in walk(root):
        classes, text = node.classes, node.text
        if node.tag == "a" and node.attrs.get("href", "") in {"", "#"}:
            destination = {"忘记密码？": "/opcforgotpassword", "立即注册": "/opcregister", "立即登录": "/opclogin", "返回登录": "/opclogin", "返回首页": "/"}.get(text)
            if destination:
                node.attrs["href"] = destination
        if "count-num" in classes and node.attrs.get("data-target", "").isdigit():
            node.children = [format(int(node.attrs["data-target"]), ",")]
        if "mobile-menu" in classes or "menu-backdrop" in classes:
            action(node, "menu")
            node.attrs["aria-label"] = "打开或关闭导航菜单"
        elif "login-btn" in classes and node.tag == "button" and path not in {"/opclogin", "/opcregister", "/opcforgotpassword"}:
            action(node, "navigate", route="/opclogin")
        elif "filter-chip" in classes:
            action(node, "filter-tools", text)
        elif "tab-chip" in classes:
            action(node, "filter-market", "supply" if text == "供给" else "demand")
        elif "category-tab" in classes:
            action(node, "filter-courses", "all" if text == "全部课程" else text)
        elif "city-btn" in classes:
            action(node, "filter-city", text)
        elif "filter-btn" in classes:
            action(node, "filter-news", text)
        elif "njz-chip" in classes:
            action(node, "filter-district", text)
        elif "load-more-btn" in classes:
            action(node, "load-more", path)
        elif path == "/zone" and "tab-btn" in classes and node.tag != "a":
            action(node, "filter-zone", "news" if text == "政策资讯" else "join")
        elif path == "/" and node.tag == "button" and "text-link" in classes:
            action(node, "navigate", route="/newslist")
        elif "event-more-btn" in classes:
            action(node, "navigate", route="/activitylist")
        elif "njz-enter-btn" in classes:
            action(node, "navigate", route="/nanjingzone")
        elif "rental-btn" in classes:
            action(node, "apply", "computing", "/opcapply?formType=computing")
        elif "hero-btn--primary" in classes and path == "/work":
            action(node, "work-platform")
        elif node.tag == "button" and ("hero-btn--ghost" in classes or "cta-btn" in classes) and path == "/work":
            action(node, "apply", "opc", "/opcapply?formType=opc")
        elif node.tag == "button" and "btn-cta" in classes:
            action(node, "apply", "community", "/opcapply?formType=community")
        elif node.tag == "button" and classes & {"submit-btn", "register-btn", "reset-btn"}:
            action(node, "form-submit")
        elif "password-toggle" in classes:
            action(node, "toggle-password")
            node.attrs["aria-label"] = "显示或隐藏密码"
        elif "send-code-btn" in classes:
            action(node, "request-code")
        if node.tag == "input":
            placeholder = node.attrs.get("placeholder", "")
            if path in {"/agent", "/nanjingzone"} and ("搜索" in placeholder or "search" in node.attrs.get("class", "")):
                node.attrs["data-opc-search"] = "tools" if path == "/agent" else "communities"
                node.attrs.setdefault("aria-label", placeholder)
        if "tool-card" in classes:
            tool_title = first(node, "tc-title")
            tool = next((x for x in directory["agents"] if x["title"] == (tool_title.text if tool_title else text)), None)
            if tool:
                node.attrs["data-opc-categories"] = json.dumps(tool["primary"], ensure_ascii=False)
                node.attrs["data-opc-search-text"] = tool["title"] + " " + tool["text"]
        if "opc-card" in classes:
            item = next((x for x in sorted(directory["communities"], key=lambda x: -len(x["name"])) if x["name"] in text), None)
            if item:
                node.attrs["data-opc-city"] = item["city"]
            if path in {"/zone", "/community"}:
                action(node, "apply", "community", "/opcapply?formType=community")
        if "njz-card" in classes:
            item = next((x for x in directory["nanjingCommunities"] if x["name"] in text), None)
            if item:
                node.attrs["data-opc-district"] = item["district"]
                node.attrs["data-opc-search-text"] = item["name"] + " " + item["address"]
        card_classes = classes & {"news-card", "news-item", "activity-item", "activity-card", "event-card", "course-card", "supply-card", "demand-card"}
        if card_classes:
            identifier = card_id(node, matching_records)
            if identifier:
                node.attrs["data-opc-id"] = str(identifier)
                record = next(x for x in records if x["id"] == identifier)
                if "course-card" in classes:
                    node.attrs["data-opc-category"] = sub(record, 7) or "其他"
                    action(node, "course-detail", identifier)
                elif classes & {"news-card", "news-item", "activity-item", "activity-card", "event-card", "supply-card", "demand-card"}:
                    action(node, "navigate", route=f"/newsdetail?id={identifier}")
                    node.attrs["data-opc-category"] = sub(record, 2)
        if "article-content" in classes:
            node.attrs["data-opc-article"] = ""
    if path == "/computingresource":
        offers = directory["gpu"]["1"]
        for card in by_class(root, "rental-card"):
            title = next((n for n in walk(card) if n.tag == "h3"), None)
            offer = next((item for item in offers if title and item["name"] == title.text), None)
            button = first(card, "rental-btn")
            if not offer or not button:
                continue
            prices = offer["prices"]
            price_parts = []
            if prices.get("hourly"):
                price_parts.append(f'卡时租赁：{prices["hourly"]}元/时')
            price_parts.extend([f'包月租赁：{prices["monthly"]}元/月', f'包年租赁：{prices["yearly"]}元/年'])
            query = urlencode({"formType": "computing", "serverName": offer["name"], "serverCompute": offer["compute"], "serverPrice": "，".join(price_parts)})
            action(button, "apply", "computing", "/opcapply?" + query)


def complete_lists(root, path, records):
    """Retain original cards and clone their visual template for later pages."""
    mapping = {"/newslist": (10, "news-list"), "/activitylist": (16, "activity-list")}
    if path not in mapping:
        return
    category, container_class = mapping[path]
    container = first(root, container_class)
    if not container:
        return
    cards = [n for n in container.children if isinstance(n, Node)]
    if not cards:
        return
    template = cards[0]
    category_records = [r for r in records if r["category_id"] == category]
    present = {card_id(c, category_records) for c in cards}
    for record in category_records:
        if record["id"] in present:
            continue
        card = copy.deepcopy(template)
        for name in ["news-title", "activity-title"]:
            set_text(card, name, record["title"])
        for name in ["news-summary", "activity-description"]:
            set_text(card, name, sub(record, 1))
        set_text(card, "news-date", date_for(record))
        image = next((n for n in walk(card) if n.tag == "img"), None)
        if image and record.get("head_image"):
            image.attrs["src"] = record["head_image"][0]["url"]
            image.attrs["alt"] = record["title"]
        activity_info = first(card, "activity-info")
        if activity_info:
            cells = [n for n in activity_info.children if isinstance(n, Node) and n.tag == "div"]
            for cell, value in zip(cells, [date_for(record), sub(record, 2), sub(record, 3)]):
                cell.children = [n for n in cell.children if isinstance(n, Node) and n.tag == "i"] + [" " + value]
        card.attrs["hidden"] = ""
        card.attrs["data-opc-id"] = str(record["id"])
        card.attrs["class"] = " ".join(c for c in card.attrs.get("class", "").split() if c not in {"revealed", "is-active"})
        action(card, "navigate", route=f'/newsdetail?id={record["id"]}')
        container.children.append(card)


def complete_market(root, records):
    for sort, container_name, title_class in [(1, "supply-grid", "sc-title"), (2, "demand-grid", "dc-title")]:
        container = first(root, container_name)
        if not container:
            continue
        cards = [n for n in container.children if isinstance(n, Node)]
        if not cards:
            continue
        matching = [r for r in records if r["category_id"] == 14 and r["sort"] == sort]
        present = {card_id(c, matching) for c in cards}
        for record in matching:
            if record["id"] in present:
                continue
            card = copy.deepcopy(cards[0])
            set_text(card, title_class, record["title"])
            set_text(card, "sc-desc" if sort == 1 else "dc-desc", sub(record, 1))
            set_text(card, "sc-author-name" if sort == 1 else "dc-author", sub(record, 3))
            set_text(card, "sc-avatar" if sort == 1 else "dc-avatar", sub(record, 3)[:1])
            date = date_for(record).split("-")
            set_text(card, "sc-date" if sort == 1 else "dc-time", f"{date[0]}/{int(date[1])}/{int(date[2])}")
            tags = first(card, "sc-tags" if sort == 1 else "dc-tags")
            if tags:
                tag_template = next((n for n in tags.children if isinstance(n, Node)), Node("span", {"class": "tag"}))
                tags.children = []
                for label in re.split("[,，、]", sub(record, 2)):
                    if label:
                        tag = copy.deepcopy(tag_template)
                        tag.children = [label]
                        tags.children.append(tag)
            card.attrs["hidden"] = ""
            container.children.append(card)


def zone_variant(root, city, zone_data):
    """Update only the city's own sections, never global/footer brand text."""
    for section in [node for node in walk(root) if node.tag == "section"]:
        for node in walk(section):
            node.children = [child.replace("南京", city) if isinstance(child, str) else child for child in node.children]
    header = first(root, "page-header")
    if header:
        description = next((n for n in walk(header) if n.tag == "p"), None)
        if description:
            description.children = [zone_data["descriptions"].get(city, "")]
    grid = first(root, "opc-grid")
    if grid:
        template = next((n for n in grid.children if isinstance(n, Node)), Node("div", {"class": "opc-card"}))
        grid.children = []
        for name in zone_data["communities"].get(city, []):
            card = copy.deepcopy(template)
            cover = first(card, "opc-cover")
            if cover and city != "南京":
                card.children = [n for n in card.children if n is not cover]
            label = first(card, "opc-name")
            if label:
                label.children = [name]
                if city != "南京":
                    label.attrs["class"] = "opc-name"
            grid.children.append(card)
    return root


def localize_data(value, assets):
    if isinstance(value, str):
        return assets.get(value, value)
    if isinstance(value, list):
        return [localize_data(item, assets) for item in value]
    if isinstance(value, dict):
        return {key: localize_data(item, assets) for key, item in value.items()}
    return value


def generate():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    load_visual_media()
    source_pages = json.loads((SOURCE / "pages.json").read_text())
    public = json.loads((SOURCE / "public-content.json").read_text())
    directory = json.loads((SOURCE / "public-directory.json").read_text())
    route_meta = json.loads((SOURCE / "routes.json").read_text())
    paths = {r["path"].lower() for r in route_meta}
    assets_path = SOURCE / "asset-map.json"
    if not assets_path.exists():
        raise FileNotFoundError("Run the asset compiler first; scripts/opc-source/asset-map.json is required")
    assets = json.loads(assets_path.read_text())
    zone_data = json.loads((SOURCE / "zone-data.json").read_text())
    records = list(public["records"].values())
    selected = {}
    detail_template = None
    for page in source_pages:
        path = urlsplit(page["route"]).path.lower()
        if path == "/newsdetail" and "article-content" in page["html"]:
            detail_template = page
        if path in paths:
            selected[path] = page
    selected["/myinfo"] = selected["/opclogin"]
    selected["/opcapply"] = selected["/opclogin"]
    if not detail_template:
        raise ValueError("A real article detail capture is required")
    selected["/newsdetail"] = detail_template
    if set(selected) != paths:
        raise ValueError(f"Missing public pages: {paths - set(selected)}")
    pages = {}
    cities = set(zone_data["descriptions"])
    for path, page in selected.items():
        tree = parse(page["html"])
        remove_header_login(tree)
        localize_operator_links(tree, cities)
        complete_lists(tree, path, records)
        if path == "/market":
            complete_market(tree, records)
        enhance(tree, path, records, directory)
        replace_operator_contact(tree)
        inject_site_contact(tree)
        rebrand_tree(tree)
        inject_brand_mark(tree)
        inject_visual_media(tree, path)
        if path == "/community":
            beijing_home_region(tree)
        pages[path] = {"html": sanitize(tree, paths, assets), "title": rebrand(page["title"]), "path": path}
    shell = parse(detail_template["html"])
    remove_header_login(shell)
    localize_operator_links(shell, cities)
    set_text(shell, "article-title", "__OPC_TITLE__")
    shell_meta = first(shell, "meta-item")
    if shell_meta:
        shell_meta.children = ["__OPC_DATE__"]
    shell_article = first(shell, "article-content")
    if not shell_article:
        raise ValueError("Article template has no content container")
    shell_article.children = ["__OPC_ARTICLE__"]
    shell_article.attrs["data-opc-article"] = ""
    enhance(shell, "/newsdetail", records, directory)
    replace_operator_contact(shell)
    inject_site_contact(shell)
    rebrand_tree(shell)
    article_shell = sanitize(shell, paths, assets)
    details = {}
    for record in records:
        content = "".join(x["content"] for x in sorted(record["content"], key=lambda x: x["sort"]) if x["sort"] != -1)
        if not content.strip():
            content = "<p>" + html.escape(sub(record, 1) or record["title"]) + "</p>"
        details[str(record["id"])] = {"html": sanitize(rebrand_tree(parse(content)), paths, assets), "title": rebrand(record["title"]), "date": date_for(record), "id": record["id"]}
    listings = {"categories": public["categories"], "records": {k: {name: value for name, value in r.items() if name not in {"content", "images"}} for k, r in public["records"].items()}}
    listings = rebrand_tree_deep(listings)
    zones = {}
    for city in zone_data["descriptions"]:
        tree = zone_variant(parse(selected["/zone"]["html"]), city, zone_data)
        remove_header_login(tree)
        localize_operator_links(tree, cities)
        enhance(tree, "/zone", records, directory)
        replace_operator_contact(tree)
        inject_site_contact(tree)
        rebrand_tree(tree)
        inject_visual_media(tree, "/zone")
        zones[city] = {"html": sanitize(tree, paths, assets), "path": "/zone", "title": city + "专区 - 集智 AI OPC 社区"}
    directory = rebrand_tree_deep(directory)
    for name, value in {"pages": pages, "details": details, "directory": localize_data(directory, assets), "listings": localize_data(listings, assets), "article-shell": {"html": article_shell}, "zone-cities": zones}.items():
        (OUTPUT / f"{name}.json").write_text(json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n")
    manifest = {"source": BASE + "#/", "capturedAt": "2026-10-22", "pageCount": len(pages), "detailCount": len(details), "tools": len(directory["agents"]), "nanjingCommunities": len(directory["nanjingCommunities"]), "categories": {k: v["total"] for k, v in public["categories"].items()}}
    (OUTPUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(manifest, ensure_ascii=False))


def self_test():
    fixture = parse('<div data-v-abc="" onclick="alert(1)"><script>alert(1)</script><iframe src="https://evil.test">evil</iframe><a href="java&#115;cript:alert(1)" target="_blank">link</a><img src="data:image/svg+xml,bad" onerror="x"><p style="color:#123456;background:url(https://bad);width:expression(x);font-size:20px">safe</p><svg><use href="https://evil.test/x.svg#x"></use></svg></div>')
    output = sanitize(fixture, {"/", "/agent"}, {})
    for forbidden in ["<script", "<iframe", "onclick", "onerror", "javascript", "data:image", "expression", "url(", "evil.test"]:
        assert forbidden not in output, (forbidden, output)
    assert 'data-v-abc=""' in output and "font-size:20px" in output and "color:#123456" in output
    assert local_location("#/Agent?category=AI&evil=x", {"/agent"}) == "/agent?category=AI"
    assert local_location("https://evil.test/#/agent", {"/agent"}) is None
    assert local_location("//evil.test/#/agent", {"/agent"}) is None
    assert safe_url("java\nscript:alert(1)") == ""
    print("HTML/CSS/URL sanitizer checks passed")


if __name__ == "__main__":
    self_test()
    if "--test" not in sys.argv:
        generate()
