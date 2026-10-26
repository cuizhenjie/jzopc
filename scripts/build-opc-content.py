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
ABOUT_COPY = json.loads((ROOT / "src/lib/site/about-copy.json").read_text())

# 工具卡图标清单（scripts/fetch-tool-icons.mjs 生成，域 → 本地路径或 null）。
# 图标按 aidh.ai 同款机制（gstatic faviconV2）在构建期抓取并本地化，
# 运行期不请求任何第三方域名。
TOOL_ICON_MAP = json.loads((SOURCE / "tool-icons.json").read_text()) if (SOURCE / "tool-icons.json").exists() else {}
TOOL_ICON_PATHS = {value for value in TOOL_ICON_MAP.values() if value}


def tool_icon_for(real_url):
    """工具 realUrl → 本地图标路径（无匹配/抓取失败返回 None）。"""
    try:
        host = urlsplit(real_url).hostname or ""
    except ValueError:
        return None
    return TOOL_ICON_MAP.get(host) or TOOL_ICON_MAP.get(host.removeprefix("www."))
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
# 2026-10-23 文案菜单对齐契约 §2.Req1：导航重建后新增「关于集智 / 八大赋能 /
# 流量超市 / 申请入驻」四个入口的全部原生路径（精确成员匹配，勿重复 /empower/space）。
LOCAL_LINKS = {
    # 关于集智的三个子页已下线（2026-10-23），仅保留 /about。
    "/about",
    "/empower/space", "/empower/agents", "/empower/compute", "/empower/academy",
    "/empower/enterprise", "/empower/market", "/empower/traffic", "/empower/capital",
    "/traffic", "/apply",
}


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
# 2026-10-23 文案菜单对齐契约 §2.Req3：地址口径收敛为「北京丰台大红门」。
SITE_ADDRESS = "北京市丰台区大红门"
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
    # 原运营方资质表述（江苏口径）→ 本站口径（中关村）。
    # ⚠️ 只匹配带「江苏省」前缀的完整词组 —— 新闻正文里作为政策
    # 概念引用的「瞪羚企业」（梯度培育、独角兽征集等）不在此列，保持原样。
    ("江苏省瞪羚企业", "中关村高新"),
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
    "nanjing.opcstore.com", "shanghai.opcstore.com", "江苏省瞪羚企业",
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


# Shared navigation is rendered once by the React public shell. Generated bodies
# contain no captured header/backdrop or independent navigation data.
AUTH_BODY_PATHS = {"/opclogin", "/opcregister", "/opcforgotpassword", "/myinfo", "/opcapply"}


def remove_captured_header(root, path):
    expected = 0 if path in AUTH_BODY_PATHS else 1
    for class_name in ("opcheader", "menu-backdrop"):
        matches = by_class(root, class_name)
        if len(matches) != expected:
            raise ValueError(f"Expected {expected} captured .{class_name} on {path}; found {len(matches)}")
    remove_matching(root, lambda node: bool(node.classes & {"opcheader", "menu-backdrop"}))
    # Preserve the independent auth layouts' existing unobstructed form fields.
    remove_matching(root, lambda node: node.tag == "i" and "icon-left" in node.classes)
    return root


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


# 页脚「快速链接」对齐导航口径（2026-10-23 需求）：旧捕获名 → 新导航名。
# 按锚文本映射（本函数跑在 rebrand/sanitize 之前，href 仍是捕获原始值，
# 不能按归一后的路径精确匹配；新旧两种学院写法都兜住）。
FOOTER_LINK_RENAMES = {
    "智能体中心": "智能体",
    "交易市场": "供需市场",
    "同橙 AI 学院": "集智商学院",
    "集智AI 学院": "集智商学院",
    "集智AI学院": "集智商学院",
}
# 与导航一致的补充项（捕获页脚没有这两条）。
FOOTER_LINK_ADDITIONS = [("社区动态", "/newslist"), ("申请入驻", "/apply")]


def align_footer_links(tree):
    """页脚「快速链接」与主导航同名同址。

    · 旧名改写：智能体中心→智能体、交易市场→供需市场、学院名→
      集智商学院（href 由 sanitize 归一指向对应复刻页，仅锚文本过期）。
    · 追加导航里的 社区动态(/newslist) 与 申请入驻(/apply)。
    「服务支持」「联系我们」两组是功能入口与联系信息，不在导航对齐范围。
    """
    for item in by_class(tree, "footer-item"):
        heading = next((n for n in walk(item) if n.tag == "h4"), None)
        if heading is None or "快速链接" not in heading.text:
            continue
        ul = next((n for n in walk(item) if n.tag == "ul"), None)
        if ul is None:
            continue
        for anchor in (n for n in walk(ul) if n.tag == "a"):
            new_text = FOOTER_LINK_RENAMES.get(anchor.text.strip())
            if new_text:
                anchor.children = [new_text]
        if not any(n.text.strip() == "社区动态" for n in walk(ul) if n.tag == "a"):
            for label, href in FOOTER_LINK_ADDITIONS:
                ul.children.append(Node("li", {}, [Node("a", {"href": href}, [label])]))
    return tree


# 「加入社区 / 申请入驻」类 CTA 的锚文本口径：命中即改指 /apply。
APPLY_CTA_LABELS = {"立即申请", "立即加入", "立即入驻", "加入我们", "申请入驻"}


def redirect_apply_ctas(tree):
    """加入类 CTA 不再进登录克隆页 /opcapply，统一改跳原生申请入驻页 /apply。

    · button 且 data-opc-action="apply*"（首页 btn-cta、/work 的
      hero-btn--ghost / cta-btn 等接线产物）→ 转成 <a href="/apply">：
      /apply 不在复刻路由表里，ReplicaInteractions 的 navigate() 会放行
      默认整页跳转（与页头导航同机制），所以必须是真链接而非 action。
    · <a href="/opcapply…">：join-cta（/market）与锚文本命中 APPLY_CTA_LABELS
      的（/community、/zone 的「立即申请」）→ href 改 /apply。
    「联系合作」（供需卡洽谈）、星计划报名链接语义不同，保持原目标。
    """
    for node in walk(tree):
        if node.tag == "button" and str(node.attrs.get("data-opc-action", "")).startswith("apply"):
            node.tag = "a"
            node.attrs["href"] = "/apply"
            for key in ("data-opc-action", "data-opc-value", "data-opc-route", "type", "role", "tabindex"):
                node.attrs.pop(key, None)
        else:
            # 卡片类元素（如 community/zone 的 opc-card）保留标签与动作，
            # 仅把动作目标改到 /apply（ReplicaInteractions 的 apply 分支
            # 已统一 router.push('/apply')，这里同步 DOM 属性保持口径一致）。
            if str(node.attrs.get("data-opc-action", "")).startswith("apply"):
                node.attrs["data-opc-route"] = "/apply"
                node.attrs.pop("data-opc-value", None)
            if node.tag == "a" and "opcapply" in node.attrs.get("href", "") and ("join-cta" in node.classes or node.text.strip() in APPLY_CTA_LABELS):
                node.attrs["href"] = "/apply"
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



def apply_word_about_copy(root):
    """首页「关于我们」与「为什么选择」文案以《集智AI 网站.docx》为准替换。

    原文是原运营方（同橙科创）的集团资质叙述（含「南京市云南商会」等
    江苏背景残留）；本站口径与主站 `src/lib/site/config.ts` 的 v2/优势段同源。
    只换文字节点，DOM 结构与全部样式类保持不变。
    """
    about = next((n for n in by_class(root, "section") if "about-sec" in n.classes), None)
    if about:
        heading = next((n for n in walk(about) if n.tag == "h2"), None)
        if heading:
            # Word 的品牌口号（主站 Hero 同款）
            heading.children = ["集众智之力，启 AI 未来"]
        intro = next((n for n in walk(about) if n.tag == "p"), None)
        if intro:
            # Keep the Word overview identical to config.intros.v2; the latest
            # module label is 供需市场. Preserve its explicit two-line structure.
            lines = ABOUT_COPY["intros"]["v2"].split("\n")
            intro.children = [lines[0], Node("br"), *lines[1:]]
        drive_items = [
            ("八大赋能", "一体贯通，需求不出社区"),
            ("订单流量", "双入口，做完就能卖"),
            ("在场服务", "人才财税法务，后台不出楼"),
        ]
        for item, (title, desc) in zip(by_class(about, "adg-item"), drive_items):
            for node in walk(item):
                if "adg-item-title" in node.classes:
                    node.children = [title]
                elif "adg-item-desc" in node.classes:
                    node.children = [desc]
        badge_texts = ["八大赋能体系", "首期 3000+ ㎡ 实体空间", "2026 年 10 月启动运营"]
        for badge, text in zip(by_class(about, "ab-item"), badge_texts):
            label = next((n for n in walk(badge) if n.tag == "span" and not n.classes), None)
            if label is not None:
                label.children = [text]
    lead = first(root, "strength-lead")
    if lead:
        # Word「平台优势」主段（与 site.config 的 advantages 引言同源）；
        # 契约 §2.Req3：引言段地址口径 →「位于北京丰台大红门」。
        lead.children = [
            "集美科技旗下的一站式 AI 应用综合赋能平台，位于北京丰台大红门，首期 3000 余平米。"
            "场地、工具、算力、人才、服务、订单、流量、资金，八件事装进同一个社区。"
        ]


def apply_agent_hero_title(root):
    """/agent 页 hero h1（契约 §2.Req4）：探索 AI 的无限可能 → 集智·探索 AI 的无限可能。"""
    for node in walk(root):
        if node.tag == "h1" and node.text == "探索 AI 的无限可能":
            node.children = ["集智·探索 AI 的无限可能"]


def prepare_agent_layout(root, expected_count):
    """Reparent existing tool groups without rebuilding or duplicating any card.

    The source's filter-tools action and all 233 links remain intact. The client
    controls only visibility/status; all categories and cards are present in SSR.
    """
    stores = by_class(root, "agent-store")
    filters = by_class(root, "filter-scroll")
    groups = by_class(root, "category-sec")
    if len(stores) != 1 or len(filters) != 1 or not groups:
        raise ValueError("Expected one agent store/filter and nonempty tool groups")
    store, filter_bar = stores[0], filters[0]
    chips = [node for node in walk(filter_bar) if node.attrs.get("data-opc-action") == "filter-tools"]
    if not chips or len(chips) != len(groups) + 1:
        raise ValueError("Agent category controls do not match the captured groups")
    for chip in chips:
        chip.attrs["aria-pressed"] = "true" if chip.attrs.get("data-opc-value") == "全部" else "false"
    for index, group in enumerate(groups):
        title = next((node for node in walk(group) if node.tag == "h2"), None)
        label = first(group, "sec-eyebrow")
        if title is None or label is None or label.text != chips[index + 1].attrs.get("data-opc-value"):
            raise ValueError("Agent category heading/control mismatch")
        group.attrs["data-opc-agent-group"] = label.text
        group.attrs["aria-labelledby"] = f"agent-category-{index + 1}"
        title.attrs["id"] = f"agent-category-{index + 1}"
    # Keep only one category strip. The old filter-stats counter is superseded
    # by a single SSR/live status in the results column.
    for child in list(store.children):
        if isinstance(child, Node) and ("filter-sec" in child.classes or "category-sec" in child.classes):
            store.children.remove(child)
    count = sum(len(by_class(group, "tool-card")) for group in groups)
    if count != expected_count:
        raise ValueError(f"Expected {expected_count} tool cards; found {count}")
    layout = Node("section", {"class": "opc-agent-directory", "aria-label": "智能体工具目录"}, [
        Node("div", {"class": "container", "data-opc-agent-layout": ""}, [
            Node("aside", {"class": "opc-agent-sidebar", "data-opc-agent-sidebar": "", "aria-label": "工具分类"}, [
                Node("h2", {"class": "opc-agent-sidebar-title"}, ["浏览分类"]),
                filter_bar,
            ]),
            Node("div", {"class": "opc-agent-results", "data-opc-agent-results": ""}, [
                Node("p", {"class": "opc-agent-status", "data-opc-agent-status": "", "role": "status", "aria-live": "polite", "aria-atomic": "true"}, [f"共 {count} 个智能体"]),
                *groups,
            ]),
        ]),
    ])
    hero = first(store, "hero-agent")
    if hero is None or hero not in store.children:
        raise ValueError("Expected direct agent hero before directory")
    store.children.insert(store.children.index(hero) + 1, layout)


def apply_about_page(root):
    """Nanjing's overview/drivers/journey/vision composition, Jizhi facts only.

    Replace the captured operator body before media injection. Keep its existing
    local footer; the public shell adds the only header outside this body.
    """
    targets = by_class(root, "aboutus")
    if len(targets) != 1:
        raise ValueError(f"Expected one /about content root; found {len(targets)}")
    target = targets[0]
    footers = [child for child in target.children if isinstance(child, Node) and "opcbottom" in child.classes]
    if len(footers) != 1:
        raise ValueError("Expected one existing /about footer")
    intro = ABOUT_COPY["intros"]
    advantages = ABOUT_COPY["advantages"]
    visions = ABOUT_COPY["visions"]
    if len(intro["v3"]) != 3 or len(advantages) != 4 or len(visions) != 4:
        raise ValueError("About copy must preserve the approved three paragraphs/four advantages/four visions")

    def heading(eyebrow, title, identifier):
        return Node("div", {"class": "opc-about-heading"}, [
            Node("span", {"class": "opc-about-eyebrow"}, [eyebrow]),
            Node("h2", {"id": identifier}, [title]),
        ])

    overview = Node("section", {"class": "opc-about-section opc-about-overview", "aria-labelledby": "about-overview-title"}, [
        Node("div", {"class": "container opc-about-overview-grid"}, [
            Node("div", {"class": "opc-about-overview-copy"}, [
                heading("ABOUT JIZHI", "社区概况", "about-overview-title"),
                Node("p", {}, [intro["v3"][0]]),
                Node("p", {}, [intro["v3"][2]]),
                Node("p", {"class": "opc-about-backing"}, [advantages[3]]),
            ]),
            Node("figure", {"class": "opc-about-overview-media"}, [
                visual_image("reference-city-window", sizes="(max-width: 900px) 100vw, 44vw"),
                Node("figcaption", {}, ["连接城市与产业，让 AI 创业在此生长"]),
            ]),
        ]),
    ])
    driver_descriptions = [
        "场地、工具、算力、人才、服务、订单、流量、资金，八件事装进同一个社区。",
        "供需市场把社区能力与外部 1000+ 家企业需求放在同一张桌子上；流量赋能依托已入驻社区的 AIGC 流量生产基地，让产品先被看见。",
        "企服超市承接人事、财税、法务与知产，丰台区人力资源服务中心与青创会已驻场空间，办事窗口就在楼里。",
    ]
    drivers = Node("section", {"class": "opc-about-section opc-about-drivers", "aria-labelledby": "about-drivers-title"}, [
        Node("div", {"class": "container"}, [
            heading("THREE DRIVERS", "让创业所需，在社区内连接", "about-drivers-title"),
            Node("div", {"class": "opc-about-driver-grid"}, [
                Node("article", {"class": "opc-about-driver"}, [
                    Node("span", {"class": "opc-about-driver-number", "aria-hidden": "true"}, [f"0{index + 1}"]),
                    Node("div", {"class": "opc-about-driver-icon", "aria-hidden": "true"}, [visual_image(icon, decorative=True)]),
                    Node("h3", {}, [title]),
                    Node("p", {}, [description]),
                ]) for index, (title, description, icon) in enumerate(zip(advantages[:3], driver_descriptions, ["icon-community", "icon-market", "icon-work"]))
            ]),
        ]),
    ])
    # Names/links are guarded against config.empowerModules by the content test.
    empower = [
        ("space", "集智空间"), ("agents", "智能体"), ("compute", "算力超市"),
        ("academy", "集智商学院"), ("enterprise", "企服超市"), ("market", "供需市场"),
        ("traffic", "流量赋能"), ("capital", "资本政策"),
    ]
    enablers = Node("section", {"class": "opc-about-section opc-about-enablers", "aria-labelledby": "about-enablers-title"}, [
        Node("div", {"class": "container"}, [
            heading("EIGHT ENABLERS", "八大赋能，一站连接", "about-enablers-title"),
            Node("p", {"class": "opc-about-enablers-intro"}, [intro["v3"][1]]),
            Node("ul", {"class": "opc-about-enabler-list"}, [
                Node("li", {}, [Node("a", {"href": f"/empower/{slug}"}, [
                    Node("span", {"class": "opc-about-enabler-index", "aria-hidden": "true"}, [f"0{index + 1}"]),
                    Node("span", {}, [title]),
                    Node("span", {"class": "opc-about-enabler-arrow", "aria-hidden": "true"}, ["↗"]),
                ])]) for index, (slug, title) in enumerate(empower)
            ]),
        ]),
    ])
    history = Node("section", {"class": "opc-about-section opc-about-journey", "aria-labelledby": "about-journey-title"}, [
        Node("div", {"class": "container"}, [
            heading("OUR JOURNEY", "发展历程", "about-journey-title"),
            Node("ol", {"class": "opc-about-timeline"}, [
                Node("li", {"class": "opc-about-milestone"}, [
                    Node("time", {"datetime": "2026-10"}, ["2026 年 10 月"]),
                    Node("div", {"class": "opc-about-milestone-card"}, [
                        Node("h3", {}, ["集智 AI OPC 社区启动运营"]),
                        Node("p", {}, [intro["v3"][0]]),
                    ]),
                ]),
            ]),
            Node("p", {"class": "opc-about-journey-note"}, ["更多发展节点持续整理中。"]),
        ]),
    ])
    vision = Node("section", {"class": "opc-about-vision", "aria-labelledby": "about-vision-title"}, [
        Node("div", {"class": "container"}, [
            Node("span", {"class": "opc-about-eyebrow"}, ["OUR VISION"]),
            Node("h2", {"id": "about-vision-title"}, [visions[0]]),
            Node("ul", {"class": "opc-about-vision-list"}, [Node("li", {}, [line]) for line in visions[1:]]),
            Node("a", {"class": "opc-about-vision-link", "href": "/apply"}, ["加入集智社区", Node("span", {"aria-hidden": "true"}, [" ↗"])]),
        ]),
    ])
    target.attrs["data-opc-about-page"] = ""
    target.children = [
        Node("section", {"class": "hero-section"}, [Node("div", {"class": "container"}, [
            Node("span", {"class": "sec-eyebrow"}, ["ABOUT JIZHI"]),
            Node("h1", {}, ["关于集智"]),
            Node("p", {"class": "hero-desc"}, [intro["v1"]]),
        ])]),
        overview, drivers, enablers, history, vision, footers[0],
    ]


# /market 加入区四步（契约 §2.Req7，与 config.ts marketSteps 逐字一致）。
MARKET_JOIN_ITEMS = [
    ("供需发布", "发布 AI 项目需求或智能体服务，高效撮合产业合作机会"),
    ("智能匹配", "依托社区生态，精准对接开发者、投资方与产业资源"),
    ("能力展示", "上架AI产品与落地案例，打造个人与项目品牌影响力"),
    ("产业共创", "融入集智 AI 开放社区，携手伙伴共建 AI 智能体产业生态"),
]


def apply_market_join_copy(root):
    """Keep the market's visible name consistent with the public navigation."""
    hero = first(root, "hero-market")
    titles = [node for node in walk(hero) if node.tag == "h1"] if hero else []
    if len(titles) != 1:
        raise ValueError("Expected one market hero title")
    titles[0].children = ["供需市场"]
    set_text(hero, "sec-eyebrow", "连接需求与能力")
    join = next((n for n in by_class(root, "section") if "join-sec" in n.classes), None)
    if not join:
        return
    heading = next((n for n in walk(join) if n.tag == "h2"), None)
    if heading:
        heading.children = ["加入集智 AI 供需市场"]
    set_text(join, "sec-sub", "上架智能体能力，发布项目需求，链接产业伙伴，共筑 AI 产业新生态")
    for item, (title, desc) in zip(by_class(join, "join-item"), MARKET_JOIN_ITEMS):
        item_title = next((n for n in walk(item) if n.tag == "h4"), None)
        if item_title:
            item_title.children = [title]
        item_desc = next((n for n in walk(item) if n.tag == "p"), None)
        if item_desc:
            item_desc.children = [desc]


# 集智商学院特色 5 项（契约 §2.Req8：仅标题，去描述）。
# fi-icon 语义配图：复用原站 4 个 svg path，再补 2 个简单几何 path
# （研学班 = 纸飞机/出行方向；项目驱动 = 分层堆叠；名企合作 = 公文包）。
ACADEMY_FEATURES = [
    ("实战教学", [
        ("polygon", {"points": "23 7 16 12 23 17 23 7"}),
        ("rect", {"x": "1", "y": "5", "width": "15", "height": "14", "rx": "2", "ry": "2"}),
    ]),
    ("AIGC认证", [
        ("circle", {"cx": "12", "cy": "8", "r": "7"}),
        ("polyline", {"points": "8.21 13.89 7 23 12 20 17 23 15.79 13.88"}),
    ]),
    ("研学班", [
        ("polygon", {"points": "3 11 22 2 13 21 11 13 3 11"}),
    ]),
    ("项目驱动", [
        ("polyline", {"points": "12 2 2 7 12 12 22 7 12 2"}),
        ("polyline", {"points": "2 17 12 22 22 17"}),
        ("polyline", {"points": "2 12 12 17 22 12"}),
    ]),
    ("名企合作", [
        ("rect", {"x": "2", "y": "7", "width": "20", "height": "14", "rx": "2", "ry": "2"}),
        ("path", {"d": "M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"}),
    ]),
]

# 培训课程体系 5 卡（契约 §0 表）。配图取舍：visual-media.json 里没有电商 /
# AIGC / 大数据 / 短视频的专项照片，从 activity-* 实拍图里挑语义最贴切的
# 5 张（数智化调研→电商运营、学员漫剧作品→AIGC 内容生产、漫剧培训→AI漫剧、
# 自动驾驶调研→大数据技术、视频调研→短视频），不做渐变兜底。
ACADEMY_COURSES = [
    ("course-ai-ecommerce", "AI电商", "选品、内容与店铺智能运营", "增长实战"),
    ("course-aigc", "AIGC", "文案、图像与视频内容生产", "热门方向"),
    ("course-ai-comic", "AI漫剧", "脚本、分镜与AI漫剧制作", "项目实训"),
    ("course-bigdata", "大数据工程师", "Hadoop、Spark、Flink 技术栈", "技术岗位"),
    ("course-shortvideo", "短视频运营", "策划、制作与账号增长运营", "就业实用"),
]

# 一站式就业服务 6 步（契约 §0 表）。
EMPLOY_STEPS = [
    ("STEP 01", "职业测评", "精准定位职业方向", ["能力测评", "兴趣测评", "价值观评估"]),
    ("STEP 02", "技能培训", "行业导师带教实训", ["线下实操课", "专项技能学", "企业真实项目"]),
    ("STEP 03", "项目实战", "学中做，快速提升竞争力", ["企业级项目", "团队协作训练", "项目成果展示"]),
    ("STEP 04", "求职面试", "全真演练，精准从业求职", ["简历优化", "模拟面试", "企业岗位匹配"]),
    ("STEP 05", "就业推荐", "直通企业，高效就业上岗", ["企业岗位推荐", "定制化岗位推荐", "就业跟踪服务"]),
    ("STEP 06", "入职跟踪", "入职不孤单，助你成长", ["试用期跟踪", "职场适应辅导", "长期成长支持"]),
]

ACADEMY_SCOPE = "e15916de"  # /center 页的 data-v 作用域（沿用捕获页，动画/样式选择器依赖它）


def apply_academy_page(root):
    """集智商学院（/center）四段改造（契约 §2.Req8）。

    · hero：h1 →「集智商学院」，h1 后插入口号行（hero-slogan，250ms 顺延
      进 200ms h1 与 300ms 分隔线之间，后续节点原 delay 不动），desc 换新；
      眉题与 h1 同文，一并同步（否则页面顶部出现新旧两个学院名）。
    · features-sec：4 项带描述 → 5 项仅标题。
    · courses-sec：整体重建为「培训课程体系」5 卡，移除分类 tab 条与旧
      course-grid（course-detail 弹窗交互随节点移除，新卡不带 data-opc-action）。
    · path-sec：整体重建为「一站式就业服务」6 步（替换原 4 步学习路径）。
      保留 section 类名（path-sec），辅助相册位于该节之后。
    """
    academy = first(root, "center")
    if academy is None:
        raise ValueError("Missing /center layout root")
    academy.attrs["data-opc-academy-layout"] = ""
    scope = {"data-v-" + ACADEMY_SCOPE: ""}

    def scoped(tag, attrs=None, children=None):
        merged = dict(scope)
        merged.update(attrs or {})
        return Node(tag, merged, children or [])

    # ── hero ──
    hero = first(root, "hero-center")
    if hero:
        hero_container = next((n for n in walk(hero) if "container" in n.classes), None)
        if hero_container:
            eyebrow = next((n for n in walk(hero_container) if "sec-eyebrow" in n.classes), None)
            if eyebrow:
                eyebrow.children = ["AI EDUCATION"]
            h1 = next((n for n in walk(hero_container) if n.tag == "h1"), None)
            if h1:
                h1.children = ["集智商学院"]
                hero_container.children.insert(
                    hero_container.children.index(h1) + 1,
                    scoped("p", {
                        "class": "hero-slogan hero-anim-fade-up",
                        "style": "animation-delay:250ms",
                    }, ["学AI技能拿高薪Offer让未来，从这里开始"]),
                )
            set_text(hero_container, "hero-desc", "提供AI人才培养与就业服务，助力个人成长与企业数字化升级")

    # ── features-sec：5 项仅标题 ──
    features = first(root, "features-grid")
    if features:
        items = []
        for index, (title, shapes) in enumerate(ACADEMY_FEATURES):
            icon = scoped("svg", {
                "viewbox": "0 0 24 24", "fill": "none",
                "stroke": "currentColor", "stroke-width": "2",
            }, [scoped(tag, attrs) for tag, attrs in shapes])
            items.append(scoped("div", {
                "class": "feature-item hero-anim-fade-up revealed",
                "style": f"animation-delay:{500 + index * 100}ms",
            }, [
                scoped("div", {"class": "fi-icon"}, [icon]),
                scoped("h4", {}, [title]),
            ]))
        features.children = items

    # ── courses-sec → 培训课程体系 ──
    courses_sec = next((n for n in by_class(root, "section") if "courses-sec" in n.classes), None)
    if courses_sec:
        courses_container = next((n for n in walk(courses_sec) if "container" in n.classes), None)
        head = next((n for n in walk(courses_sec) if "sec-head" in n.classes), None)
        if head is not None:
            heading = next((n for n in walk(head) if n.tag == "h2"), None)
            if heading:
                heading.children = ["培训课程体系"]
            set_text(head, "sec-sub", "紧跟行业需求，打造系统化AI人才培养体系")
        cards = []
        for asset_id, name, description, tag in ACADEMY_COURSES:
            cards.append(Node("figure", {"class": "opc-academy-course-card"}, [
                Node("div", {"class": "opc-academy-course-media"}, [
                    visual_image(asset_id, sizes="(max-width: 767px) 50vw, 20vw"),
                ]),
                Node("figcaption", {}, [
                    Node("span", {"class": "opc-academy-course-tag"}, [tag]),
                    Node("h3", {}, [name]),
                    Node("p", {}, [description]),
                ]),
            ]))
        grid = Node("div", {"class": "opc-academy-course-grid"}, cards)
        if courses_container is not None:
            # 移除分类 tab 条与旧 course-grid，只保留 head + 新卡组。
            courses_container.children = [
                child for child in courses_container.children
                if isinstance(child, Node) and "sec-head" in child.classes
            ] + [grid]

    # ── path-sec → 一站式就业服务 ──
    path_sec = next((n for n in by_class(root, "section") if "path-sec" in n.classes), None)
    if path_sec:
        path_container = next((n for n in walk(path_sec) if "container" in n.classes), None)
        head = next((n for n in walk(path_sec) if "sec-head" in n.classes), None)
        if head is not None:
            eyebrow = next((n for n in walk(head) if "sec-eyebrow" in n.classes), None)
            if eyebrow:
                eyebrow.children = ["就业服务"]
            heading = next((n for n in walk(head) if n.tag == "h2"), None)
            if heading:
                heading.children = ["一站式就业服务"]
            set_text(head, "sec-sub", "从学习到就业，全程陪伴，让每一次努力都有结果")
        steps = Node("ol", {"class": "opc-employ-steps"}, [
            Node("li", {}, [
                Node("span", {"class": "opc-employ-num"}, [number]),
                Node("h3", {}, [name]),
                Node("p", {"class": "opc-employ-slogan"}, [slogan]),
                Node("ul", {"class": "opc-employ-points"}, [
                    Node("li", {}, [point]) for point in points
                ]),
            ])
            for number, name, slogan, points in EMPLOY_STEPS
        ])
        if path_container is not None:
            path_container.children = [
                child for child in path_container.children
                if isinstance(child, Node) and "sec-head" in child.classes
            ] + [steps]


def replace_home_hero(tree):
    """Keep the reference carousel structure; use local, responsive brand imagery."""
    if not by_class(tree, "hero"):
        return tree
    hero_variants = ["computing-banner", "hero-city-12", "hero-city-11", "hero-city-13"]
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
    bodies = by_class(tree, "hero-body")
    if len(bodies) != 1:
        raise ValueError("Expected one homepage hero body")
    body = bodies[0]
    stats = first(body, "hero-stats-row")
    if stats is None or stats not in body.children:
        raise ValueError("Expected homepage statistics inside the hero body")
    # Plain SSR anchors remain usable before hydration and with JavaScript off.
    # Keep the existing carousel/statistics nodes and their stacking untouched.
    if not by_class(body, "opc-home-actions"):
        body.children.insert(body.children.index(stats), Node("div", {"class": "opc-home-actions"}, [
            Node("a", {"class": "opc-home-action opc-home-action-primary", "href": "/agent"}, ["探索智能体"]),
            Node("a", {"class": "opc-home-action opc-home-action-secondary", "href": "/apply"}, ["申请入驻"]),
        ]))
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


def replace_home_about_background(tree):
    """Replace only the captured homepage's decorative about image."""
    target = tree
    for class_name in ("about-sec", "about-bg-img", "about-bg-el"):
        matches = by_class(target, class_name)
        if len(matches) != 1:
            raise ValueError(f"Expected one homepage about background target: .{class_name}; found {len(matches)}")
        target = matches[0]
        if class_name == "about-bg-img":
            target.attrs["aria-hidden"] = "true"
    images = [node for node in walk(target) if node.tag == "img"]
    if len(images) != 1:
        raise ValueError(f"Expected one homepage about background image; found {len(images)}")
    image = images[0]
    # A stale responsive source would take precedence over the replacement src.
    for attr in ("srcset", "sizes"):
        image.attrs.pop(attr, None)
    image.attrs.update(visual_image("reference-city-blue", decorative=True).attrs)


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


def insert_after_class(tree, class_name, addition):
    targets = [(parent, index) for parent in walk(tree) for index, child in enumerate(parent.children)
               if isinstance(child, Node) and class_name in child.classes]
    if len(targets) != 1:
        raise ValueError(f"Expected one visual insertion target .{class_name}; found {len(targets)}")
    parent, index = targets[0]
    parent.children.insert(index + 1, addition)


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


# 合作企业 16 家（2026-10-23 起接入品牌 SVG：~/Downloads/company-logos/svg，
# 经 visual-media kind=mark 落地为 /opc/visual/partner-{slug}.svg；第 15 家是豆瓣）。
COOPERATIVE_ENTERPRISES = [
    ("华为", "huawei"), ("阿里巴巴", "alibaba"), ("腾讯", "tencent"), ("字节跳动", "bytedance"),
    ("百度", "baidu"), ("美团", "meituan"), ("京东", "jingdong"), ("滴滴", "didi"),
    ("小米", "xiaomi"), ("网易", "netease"), ("哔哩哔哩", "bilibili"), ("快手", "kuaishou"),
    ("知乎", "zhihu"), ("微博", "weibo"), ("豆瓣", "douban"), ("携程", "ctrip"),
]


def visual_ecosystem():
    """合作企业板块：首页生态区与 /work 的合作伙伴区共用。

    16 家品牌 SVG logo 卡（opc-visual-partner-grid：8×2 desktop / 4×4 mobile，
    样式在 opc-components.css）。矢量原图走 visual_image()，alt 取 manifest 的
    公司名；卡片视觉以图为主，CSS 层 object-fit:contain 统一排版。
    """
    return Node("section", {"class": "section opc-visual-ecosystem"}, [Node("div", {"class": "container"}, [
        Node("div", {"class": "sec-head opc-visual-section-head"}, [
            Node("span", {"class": "sec-eyebrow"}, ["COOPERATIVE ENTERPRISES"]),
            Node("h2", {}, ["合作企业"]),
            Node("p", {}, ["与知名企业达成深度合作"]),
        ]),
        Node("ul", {"class": "opc-visual-partner-grid", "aria-label": "合作企业名单"}, [
            Node("li", {"class": "opc-visual-partner-card"}, [
                visual_image(f"partner-{slug}", class_name="opc-visual-partner-logo", sizes="(max-width: 767px) 25vw, 12vw"),
            ]) for _name, slug in COOPERATIVE_ENTERPRISES
        ]),
    ])])


def inject_visual_media(tree, path):
    training = [("activity-training-1", "技能实训", "在实践中理解 AI"), ("activity-training-2", "主题分享", "从方法到应用"), ("activity-training-3", "交流共创", "让想法相互启发")]
    if path == "/":
        replace_home_hero(tree)
        replace_home_about_background(tree)
        icons = ["agent", "market", "academy", "star", "community", "work", "computing", "gpu"]
        for feature, icon in zip(by_class(tree, "ftr-node"), icons):
            core = first(feature, "ftr-hub-core")
            if core:
                core.children = [visual_image("icon-" + icon, decorative=True, class_name="opc-visual-service-icon")]
        learning = [("activity-ai-drama", "AI内容创作", "一起探索 AI 漫剧")] + training + [("activity-study-unitree", "产业研学", "走近机器人应用"), ("activity-study-brainco", "技术交流", "看见新的应用可能")]
        insert_before_class(tree, "news-sec", visual_gallery("learning", "学习与交流", "从课堂实训到产业研学，在真实的交流中拓展 AI 视野。", learning))
        insert_before_class(tree, "cta-sec", visual_ecosystem())
    elif path == "/center":
        insert_after_class(tree, "path-sec", visual_gallery("academy", "在实践中学习", "把方法带进课堂，把想法带入创作与交流。", training))
    elif path == "/community":
        scene = visual_gallery("scene", "实践与共创", "学习、分享与协作，让 AI 创作走进日常。", [training[0], training[2]])
        insert_before_class(tree, "join-section", scene)
    elif path == "/work":
        for parent in walk(tree):
            for index, child in enumerate(parent.children):
                if isinstance(child, Node) and "partners-section" in child.classes:
                    parent.children[index] = visual_ecosystem()
    elif path == "/market":
        # 2026-10-23 需求：供需市场页同样展示 16 家合作企业 logo 墙，
        # 与首页同款（visual_ecosystem），插在「申请加入」区之后。
        join = next((n for n in by_class(tree, "section") if "join-sec" in n.classes), None)
        if join is not None:
            parent = next(p for p in walk(tree) if join in p.children)
            parent.children.insert(parent.children.index(join) + 1, visual_ecosystem())
    hero_classes = {"/agent": "hero-agent", "/market": "hero-market", "/center": "hero-center", "/starproject": "hero-sp", "/work": "hero", "/about": "hero-section"}
    hero = first(tree, hero_classes.get(path, "page-header")) if path != "/" else None
    if hero:
        # 子页 banner 统一参考 /center 版式（2026-10-23 需求）：全部走浅底 +
        # 右侧背景图（opc-visual-hero）。曾经的 has-visual-dark 深色横幅
        # （/work、/community）随之退役，统一为 center 同款视觉。
        hero.attrs["class"] = hero.attrs.get("class", "") + " opc-visual-hero has-visual"
        asset_id = "hero-city-13" if path == "/market" else "hero-city-11" if path == "/agent" else "hero-city-12"
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
    if raw in TOOL_ICON_PATHS:
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
        # 南京专区板块已按要求移除：整段删除，页面与入口一并下线。
        remove_matching(root, lambda node: "njz-sec" in node.classes)
        # 首页 banner（契约 §2.Req2）：desc 与四个指标的 num/label 全换。
        set_text(root, "hero-desc",
                 "一站式 AI 应用综合赋能平台，为创业者提供空间、算力、技术、培训、流量、订单、企业服务、资本政策全方位的支持。")
        hero_stat_values = ["500+", "1000+", "100+", "50+"]
        hero_stat_labels = ["入驻智能体", "活跃创业者", "精品课程", "生态伙伴企业"]
        for node, value in zip(by_class(root, "hero-stat-num"), hero_stat_values):
            node.children = [value]
        for node, value in zip(by_class(root, "hero-stat-lbl"), hero_stat_labels):
            node.children = [value]
        # GPU资源特性卡随 /computingresource 页面一并下线；
        # 接线后仍是 div（无 feature）的 ftr-node 整张移除，网格自动回流。
        features = [
            item for item in json.loads((SOURCE / "home-features.json").read_text())
            if item["page"] != "computingresource"
        ]
        for node in by_class(root, "ftr-node"):
            label = first(node, "ftr-tag")
            feature = next((item for item in features if label and item["title"] == label.text), None)
            if feature:
                node.tag = "a"
                if feature["page"] == "computing":
                    node.attrs.update(href="https://ai.opcstore.com", target="_blank")
                else:
                    node.attrs["href"] = "/" + feature["page"]
        remove_matching(root, lambda node: "ftr-node" in node.classes and node.tag != "a")
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
        elif "load-more-btn" in classes:
            action(node, "load-more", path)
        elif path == "/zone" and "tab-btn" in classes and node.tag != "a":
            action(node, "filter-zone", "news" if text == "政策资讯" else "join")
        elif path == "/" and node.tag == "button" and "text-link" in classes:
            action(node, "navigate", route="/newslist")
        elif "event-more-btn" in classes:
            action(node, "navigate", route="/activitylist")
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
            if path == "/agent" and ("搜索" in placeholder or "search" in node.attrs.get("class", "")):
                node.attrs["data-opc-search"] = "tools"
                node.attrs.setdefault("aria-label", placeholder)
        if "tool-card" in classes:
            tool_title = first(node, "tc-title")
            tool = next((x for x in directory["agents"] if x["title"] == (tool_title.text if tool_title else text)), None)
            if tool:
                node.attrs["data-opc-categories"] = json.dumps(tool["primary"], ensure_ascii=False)
                node.attrs["data-opc-search-text"] = tool["title"] + " " + tool["text"]
                # 工具图标（aidh.ai 同款 gstatic faviconV2 机制，构建期本地化）：
                # tc-body 里没有图标位 —— 注入为第一个子节点，标题/描述布局不变。
                icon = tool_icon_for(tool["realUrl"])
                card_body = first(node, "tc-body")
                if icon and card_body and not any(
                    isinstance(child, Node) and "tc-icon" in child.classes for child in card_body.children
                ):
                    card_body.children.insert(0, Node("img", {"class": "tc-icon", "src": icon, "alt": "", "loading": "lazy"}))
        if "opc-card" in classes:
            item = next((x for x in sorted(directory["communities"], key=lambda x: -len(x["name"])) if x["name"] in text), None)
            if item:
                node.attrs["data-opc-city"] = item["city"]
            if path in {"/zone", "/community"}:
                action(node, "apply", "community", "/opcapply?formType=community")
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


# ── 列表页动态化（P1 契约：docs/14-动态内容契约.md）───────────────────
# /newslist 与 /activitylist 的卡片不再烘焙进 pages.json：容器内只留一个
# 纯文本占位符，运行时注入 DB 卡片，无库 / 查询异常时注入兜底串。
# 占位符文本与 src/lib/opc/taxonomy.ts 的 LIST_PLACEHOLDER 同源 ——
# 改一处必须同步另一处。
# 条目：(容器类, 卡片类, 兜底产物键, 占位符文本)
LIST_PLACEHOLDERS = {
    "/newslist": ("news-list", "news-item", "news", "__OPC_NEWS_LIST__"),
    "/activitylist": ("activity-list", "activity-item", "activities", "__OPC_ACTIVITY_LIST__"),
}


def extract_list_cards(tree, path, paths, assets):
    """摘出列表页卡片做无库兜底快照，容器内改放纯文本占位符。

    ⚠️ 必须在**原始树**上提取（与烘焙同一棵树、同一份 asset-map）：
    若对 pages.json 成品再 parse+sanitize，本地图片路径会被 sanitize 的
    media 分支反向绝对化成 `https://opcstore.com/opc/assets/...`
    （asset-map 的键是远程 URL，本地 `/opc/assets/...` 查不到映射就
    原样通过 urljoin(BASE, …) 绝对化）。
    sanitize() 按节点递归、不依赖祖先上下文：对卡片子树单独调用的输出
    与它在整页里的渲染逐字节一致，因此这里逐张 sanitize 后直接拼接。

    容器结构由契约固定（卡片是容器唯一子节点形态）：出现文本节点或
    非卡片子节点时立刻报错，防止快照静默漏卡。
    """
    container_class, card_class, _, placeholder = LIST_PLACEHOLDERS[path]
    container = first(tree, container_class)
    if container is None:
        raise ValueError(f"{path}: missing .{container_class} container")
    cards = []
    for child in container.children:
        if not isinstance(child, Node):
            raise ValueError(f"{path}: unexpected text node in .{container_class}: {child!r}")
        if card_class not in child.classes:
            raise ValueError(f"{path}: unexpected non-.{card_class} child in .{container_class}")
        cards.append(child)
    if not cards:
        raise ValueError(f"{path}: no .{card_class} cards to snapshot")
    snapshot = "".join(sanitize(card, paths, assets) for card in cards)
    container.children = [placeholder]
    return snapshot


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
    # GPU资源页已下线：路由集合排除后，selected 因 `path in paths` 自然跳过。
    paths = {r["path"].lower() for r in route_meta} - {"/computingresource"}
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
    list_cards = {}
    cities = set(zone_data["descriptions"])
    for path, page in selected.items():
        tree = parse(page["html"])
        remove_captured_header(tree, path)
        if path == "/about":
            apply_about_page(tree)
        localize_operator_links(tree, cities)
        complete_lists(tree, path, records)
        if path == "/market":
            complete_market(tree, records)
        enhance(tree, path, records, directory)
        replace_operator_contact(tree)
        inject_site_contact(tree)
        align_footer_links(tree)
        redirect_apply_ctas(tree)
        rebrand_tree(tree)
        inject_visual_media(tree, path)
        if path == "/":
            apply_word_about_copy(tree)
        elif path == "/agent":
            apply_agent_hero_title(tree)
            prepare_agent_layout(tree, len(directory["agents"]))
        elif path == "/market":
            apply_market_join_copy(tree)
        elif path == "/center":
            apply_academy_page(tree)
        elif path == "/community":
            beijing_home_region(tree)
        if path in LIST_PLACEHOLDERS:
            # 必须在整页 sanitize 之前做：既摘走卡片、又把占位符放进容器，
            # 让 pages.json 与 list-cards.json 在同一次构建里产出。
            channel = LIST_PLACEHOLDERS[path][2]
            list_cards[channel] = extract_list_cards(tree, path, paths, assets)
        page_titles = {"/about": "关于集智 - 集智 AI OPC 社区", "/market": "供需市场 - 集智 AI OPC 社区"}
        pages[path] = {"html": sanitize(tree, paths, assets), "title": page_titles.get(path, rebrand(page["title"])), "path": path}
    shell = parse(detail_template["html"])
    remove_captured_header(shell, "/newsdetail")
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
    align_footer_links(shell)
    redirect_apply_ctas(shell)
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
        remove_captured_header(tree, "/zone")
        localize_operator_links(tree, cities)
        enhance(tree, "/zone", records, directory)
        replace_operator_contact(tree)
        inject_site_contact(tree)
        align_footer_links(tree)
        redirect_apply_ctas(tree)
        rebrand_tree(tree)
        inject_visual_media(tree, "/zone")
        zones[city] = {"html": sanitize(tree, paths, assets), "path": "/zone", "title": city + "专区 - 集智 AI OPC 社区"}
    directory = rebrand_tree_deep(directory)
    # 南京专区页已移除，其专属数据不再随生成物分发（源 public-directory.json 保持原样）。
    directory.pop("nanjingCommunities", None)
    for name, value in {"pages": pages, "details": details, "directory": localize_data(directory, assets), "listings": localize_data(listings, assets), "article-shell": {"html": article_shell}, "zone-cities": zones}.items():
        (OUTPUT / f"{name}.json").write_text(json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n")
    if set(list_cards) != {"news", "activities"}:
        raise ValueError("List card snapshots missing for: " + ", ".join(sorted({"news", "activities"} - set(list_cards))))
    # 列表页兜底快照。⚠️ 不加尾随换行：该产物的验收方式是与已验证基准
    # （无库兜底串）逐字节 diff，基准即无换行序列化；其余产物带换行的
    # 惯例在这里让位于字节一致性。
    (OUTPUT / "list-cards.json").write_text(json.dumps(list_cards, ensure_ascii=False, separators=(",", ":")))
    manifest = {"source": BASE + "#/", "capturedAt": "2026-10-22", "pageCount": len(pages), "detailCount": len(details), "tools": len(directory["agents"]), "categories": {k: v["total"] for k, v in public["categories"].items()}}
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
    # 列表页占位符是纯文本子节点：sanitize 只做 html.escape，必须原样保留
    # （__OPC_*__ 不含 HTML 特殊字符，不会被转义或过滤）。
    for placeholder in (ph[3] for ph in LIST_PLACEHOLDERS.values()):
        probe = sanitize(parse(f'<div class="news-list">{placeholder}</div>'), {"/", "/newslist"}, {})
        assert probe == f'<div class="news-list">{placeholder}</div>', (placeholder, probe)
    print("HTML/CSS/URL sanitizer checks passed")


if __name__ == "__main__":
    self_test()
    if "--test" not in sys.argv:
        generate()
