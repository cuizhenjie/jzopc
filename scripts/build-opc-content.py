#!/usr/bin/env python3
"""Build inert, local OPC reference pages from the checked-in public capture.

The input is data, never executable JavaScript. This compiler uses a strict HTML
and CSS allowlist, resolves only public routes, and emits deterministic JSON.
Run again after updating scripts/opc-source/asset-map.json to localize media.
"""
from __future__ import annotations

import copy
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
        if key in {"href", "xlink:href", "src"}:
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
    for path, page in selected.items():
        tree = parse(page["html"])
        complete_lists(tree, path, records)
        if path == "/market":
            complete_market(tree, records)
        enhance(tree, path, records, directory)
        pages[path] = {"html": sanitize(tree, paths, assets), "title": page["title"], "path": path}
    shell = parse(detail_template["html"])
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
    article_shell = sanitize(shell, paths, assets)
    details = {}
    for record in records:
        content = "".join(x["content"] for x in sorted(record["content"], key=lambda x: x["sort"]) if x["sort"] != -1)
        if not content.strip():
            content = "<p>" + html.escape(sub(record, 1) or record["title"]) + "</p>"
        details[str(record["id"])] = {"html": sanitize(parse(content), paths, assets), "title": record["title"], "date": date_for(record), "id": record["id"]}
    listings = {"categories": public["categories"], "records": {k: {name: value for name, value in r.items() if name not in {"content", "images"}} for k, r in public["records"].items()}}
    zones = {}
    for city in zone_data["descriptions"]:
        tree = zone_variant(parse(selected["/zone"]["html"]), city, zone_data)
        enhance(tree, "/zone", records, directory)
        zones[city] = {"html": sanitize(tree, paths, assets), "path": "/zone", "title": city + "专区 - 同橙OPC社区平台"}
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
