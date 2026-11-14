#!/usr/bin/env python3
"""Збирає data/nadyhanky.js з надиханок на telegra.ph.

Список надиханок лежить у data/sources.json. Щоб додати нову:
    python3 tools/import.py add <посилання на telegra.ph> --name "Ім'я Прізвище" --role "Хто це"
або, якщо надиханка вийшла прямо в каналі (можна кілька постів поспіль):
    python3 tools/import.py add https://t.me/creanotes/1655 https://t.me/creanotes/1656 --name "…" --role "…"
Щоб просто перезібрати все (наприклад, після правки тексту на telegra.ph):
    python3 tools/import.py
"""
import argparse
import html
import json
import re
import shutil
import subprocess
import sys
import urllib.parse
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCES = ROOT / "data" / "sources.json"
OUT = ROOT / "data" / "nadyhanky.js"
COVERS = ROOT / "assets" / "covers"
SHARE = ROOT / "g"
SITE_URL = "https://www.creanotes.com.ua"

QUESTIONS = [
    {"short": "Книги", "text": "Які 1–3 книги найбільше вплинули на тебе — особисто чи професійно?"},
    {"short": "Люди", "text": "Назви 1–3 людей, у яких ти чомусь навчився/навчилася за останній рік. Чому саме вони тебе навчили?"},
    {"short": "Дивна звичка", "text": "Яка в тебе є найдивніша звичка?"},
    {"short": "Рішення", "text": "Яке рішення суттєво змінило твоє життя?"},
    {"short": "Фокус", "text": "Які інструменти або практики допомагають тобі тримати фокус на головному?"},
    {"short": "Відновлення", "text": "Як ти відновлюєшся? Що тобі дає відчуття наповнення й повертає енергію?"},
    {"short": "Питання до себе", "text": "Які запитання ти ставиш собі найчастіше — у роботі, в житті, у складні моменти?"},
    {"short": "Сенс", "text": "Як ти формулюєш сенс того, чим займаєшся? Що тебе в ньому надихає?"},
    {"short": "Зміна погляду", "text": "По якому питанню ти суттєво змінив/змінила свою точку зору за останній рік?"},
    {"short": "Виклик", "text": "У чому зараз твій головний виклик — особистий чи професійний?"},
]

ALLOWED = {"p", "strong", "em", "b", "i", "u", "s", "a", "br", "ul", "ol", "li", "blockquote", "code"}
QUESTION_RE = re.compile(r"^\s*(\d{1,2})\s*\.\s+\S")
UA = "Mozilla/5.0 (nadyhanka importer)"


def fix(text):
    # в одній надиханці «к» набрано латинською «ĸ» (U+0138)
    return text.replace("ĸ", "к").replace("Ķ", "К")


def get(url):
    # curl замість urllib: Python з python.org на macOS часто не має кореневих сертифікатів
    return subprocess.run(
        ["curl", "-fsSL", "--max-time", "30", "-A", UA, url], check=True, capture_output=True
    ).stdout


def shrink(path):
    """Великі обкладинки переводимо в JPEG до 1200px (sips є на кожному Mac)."""
    if path.stat().st_size < 600_000 or not shutil.which("sips"):
        return path
    jpg = path.with_suffix(".jpg")
    subprocess.run(["sips", "-Z", "1200", "-s", "format", "jpeg", "-s", "formatOptions", "75",
                    str(path), "--out", str(jpg)], check=True, capture_output=True)
    if jpg != path:
        path.unlink()
    return jpg


def page_path(url):
    return urllib.parse.unquote(urllib.parse.urlparse(url).path.strip("/"))


def plain(node):
    if isinstance(node, str):
        return node
    return "".join(plain(c) for c in node.get("children", []))


def render(node):
    if isinstance(node, str):
        return html.escape(fix(node), quote=False)
    tag = node.get("tag")
    inner = "".join(render(c) for c in node.get("children", []))
    if tag == "br":
        return "<br>"
    if tag in ("h3", "h4"):
        tag = "p"
    if tag not in ALLOWED:
        return inner
    if tag == "a":
        href = node.get("attrs", {}).get("href", "")
        if not href.startswith(("http://", "https://")):
            return inner
        return f'<a href="{html.escape(href)}" target="_blank" rel="noopener">{inner}</a>'
    return f"<{tag}>{inner}</{tag}>"


def is_empty(node):
    return not plain(node).strip()


def is_outro(node):
    t = plain(node).strip()
    return t.startswith("———") or t.startswith("#надиханка") or "#надиханка в каналі" in t


def paragraphs_html(text):
    return "".join(f"<p>{html.escape(p.strip(), quote=False)}</p>" for p in text.split("\n\n") if p.strip())


def save_cover(url, slug):
    if not url:
        return ""
    ext = Path(urllib.parse.urlparse(url).path).suffix.lower()
    ext = ext if ext in (".jpg", ".jpeg", ".png", ".webp") else ".jpg"
    COVERS.mkdir(parents=True, exist_ok=True)
    target = COVERS / f"{slug}{ext}"
    target.write_bytes(get(url))
    return f"assets/covers/{shrink(target).name}"


def parse(src):
    path = page_path(src["url"])
    data = json.loads(get(f"https://api.telegra.ph/getPage/{urllib.parse.quote(path)}?return_content=true"))
    if not data.get("ok"):
        raise SystemExit(f"telegra.ph не віддав сторінку {src['url']}: {data}")
    page = data["result"]

    page_html = get("https://telegra.ph/" + urllib.parse.quote(path)).decode("utf-8")
    m = re.search(r'article:published_time" content="([^"]+)"', page_html)
    date = m.group(1)[:10] if m else ""

    cover_url = page.get("image_url", "")
    intro, answers, asked, current = [], [], [], None
    for node in page["content"]:
        if isinstance(node, dict) and node.get("tag") == "figure":
            if not cover_url:
                img = next((c for c in node.get("children", []) if isinstance(c, dict) and c.get("tag") == "img"), None)
                cover_url = img and img["attrs"]["src"]
            continue
        if is_outro(node):
            break
        qm = QUESTION_RE.match(fix(plain(node)))
        if qm and int(qm.group(1)) == len(answers) + 1:
            answers.append([])
            asked.append(re.sub(r"^\s*\d{1,2}\s*\.\s*", "", fix(plain(node))).strip())
            current = answers[-1]
            continue
        if is_empty(node):
            continue
        (current if current is not None else intro).append(render(node))

    if len(answers) != 10:
        print(f"  увага: у {src['name']} знайдено {len(answers)} відповідей замість 10", file=sys.stderr)

    if cover_url and cover_url.startswith("/"):
        cover_url = "https://telegra.ph" + cover_url

    return {
        "slug": src["slug"],
        "name": src["name"],
        "short": src.get("short", ""),
        "role": src.get("role", ""),
        "date": date,
        "cover": src.get("cover") or save_cover(cover_url, src["slug"]),
        # на сайті посилаємося на пост у каналі, а не на telegra.ph
        "source": f"https://t.me/creanotes/{src['post']}" if src.get("post") else "",
        "intro": paragraphs_html(src["intro"]) if src.get("intro") else "".join(intro),
        "asked": asked,
        "answers": ["".join(a) for a in answers],
    }


class TgText(HTMLParser):
    """Текст поста Telegram → безпечний HTML: лишаємо тільки форматування і посилання."""

    KEEP = {"b": "b", "strong": "b", "i": "i", "em": "i", "u": "u", "s": "s", "code": "code"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out, self.stack = [], []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "br":
            # форматування в Telegram буває через кілька рядків — закриваємо й відкриваємо його на кожному
            open_tags = [t for t in self.stack if t]
            self.out.extend(f"</{name}>" for name, _ in reversed(open_tags))
            self.out.append("\n")
            self.out.extend(opening for _, opening in open_tags)
        elif "emoji" in (attrs.get("class") or ""):
            self.stack.append(None)  # обгортка емодзі, сам символ лежить усередині
        elif tag in self.KEEP:
            self.open(self.KEEP[tag], f"<{self.KEEP[tag]}>")
        elif tag == "a" and (attrs.get("href") or "").startswith(("http://", "https://")):
            self.open("a", f'<a href="{html.escape(attrs["href"])}" target="_blank" rel="noopener">')
        else:
            self.stack.append(None)

    def open(self, name, opening):
        self.out.append(opening)
        self.stack.append((name, opening))

    def handle_endtag(self, tag):
        if tag != "br" and self.stack:
            t = self.stack.pop()
            if t:
                self.out.append(f"</{t[0]}>")

    def handle_data(self, data):
        self.out.append(html.escape(fix(data), quote=False))


def strip_tags(s):
    return html.unescape(re.sub(r"<[^>]+>", "", s))


TG_SKIP_REST = re.compile(r"^(—{2,}|-{3,}|Попередня #надиханка|#надиханка (в каналі|-|—))")
EMPTY_TAG = re.compile(r"<(b|i|u|s|code)>(\s*)</\1>")
TG_SIGNATURE = re.compile(r"^\W*Нотатки креадира\s*$")


def parse_tg(src):
    """Надиханка, опублікована прямо в каналі: один або кілька постів поспіль."""
    lines, date, cover_url = [], "", ""
    for pid in src["posts"]:
        page = get(f"https://t.me/creanotes/{pid}?embed=1&mode=tme").decode("utf-8")
        m = re.search(r'class="tgme_widget_message_text[^"]*"[^>]*>(.*?)</div>', page, re.S)
        if not m:
            raise SystemExit(f"Не знайшов текст поста t.me/creanotes/{pid}")
        if not date:
            d = re.search(r'datetime="([^"]+)"', page)
            date = d.group(1)[:10] if d else ""
        if not cover_url:
            c = re.search(r"tgme_widget_message_photo_wrap[^>]*background-image:url\('([^']+)'\)", page)
            cover_url = c.group(1) if c else ""
        p = TgText()
        p.feed(m.group(1))
        for line in "".join(p.out).split("\n"):
            text = strip_tags(line).strip()
            if TG_SKIP_REST.match(text):
                break
            if TG_SIGNATURE.match(text):
                continue
            lines.append(EMPTY_TAG.sub("", line).strip())
        lines.append("")

    intro, answers, asked = [], [], []
    current, para = intro, []

    def flush():
        if para:
            current.append("<p>" + "<br>".join(para) + "</p>")
            para.clear()

    for line in lines:
        text = strip_tags(line).strip()
        qm = QUESTION_RE.match(text)
        if qm and int(qm.group(1)) == len(answers) + 1 and "?" in text:
            flush()
            answers.append([])
            asked.append(re.sub(r"^\s*\d{1,2}\s*\.\s*", "", text))
            current = answers[-1]
        elif not text:
            flush()
        else:
            para.append(line)
    flush()

    if len(answers) != 10:
        print(f"  увага: у {src['name']} знайдено {len(answers)} відповідей замість 10", file=sys.stderr)

    return {
        "slug": src["slug"],
        "name": src["name"],
        "short": src.get("short", ""),
        "role": src.get("role", ""),
        "date": date,
        "cover": src.get("cover") or save_cover(cover_url, src["slug"]),
        "source": f"https://t.me/creanotes/{src['posts'][0]}",
        "intro": paragraphs_html(src["intro"]) if src.get("intro") else "".join(intro),
        "asked": asked,
        "answers": ["".join(a) for a in answers],
    }


def build():
    sources = json.loads(SOURCES.read_text("utf-8"))
    guests = []
    for src in sources:
        print(f"→ {src['name']}")
        guests.append(parse_tg(src) if "posts" in src else parse(src))
    guests.sort(key=lambda g: g["date"], reverse=True)
    payload = json.dumps({"questions": QUESTIONS, "guests": guests}, ensure_ascii=False, indent=1)
    OUT.write_text("// Згенеровано tools/import.py — не редагуйте вручну.\nwindow.NADYHANKY = " + payload + ";\n", "utf-8")
    share_pages(guests)
    print(f"Готово, надиханок на сайті: {len(guests)}")


SHARE_PAGE = """<!doctype html>
<html lang="uk">
<head>
<meta charset="utf-8">
<!-- Згенеровано tools/import.py — сторінка-прев'ю для шерингу. Людину одразу перекидає на сайт. -->
<title>{name} — #надиханка</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="{url}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="#надиханка">
<meta property="og:title" content="{name} — #надиханка">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{image}">
<meta name="twitter:card" content="summary_large_image">
<script>location.replace("/" + location.search + "#g-{slug}" + (/^#q\\d+$/.test(location.hash) ? "-" + location.hash.slice(1) : ""));</script>
<meta http-equiv="refresh" content="0; url=/#g-{slug}">
</head>
<body><a href="/#g-{slug}">Читати надиханку: {name}</a></body>
</html>
"""


def share_pages(guests):
    """g/<slug>/index.html для кожного гостя: Telegram і соцмережі беруть звідси прев'ю."""
    slugs = {g["slug"] for g in guests}
    if SHARE.exists():
        for d in SHARE.iterdir():
            if d.is_dir() and d.name not in slugs:
                shutil.rmtree(d)
    for g in guests:
        desc = (g.get("role") or "").strip()
        desc = (desc + ". " if desc and not desc.endswith(".") else desc + " " if desc else "") + "10 питань людям, що надихають."
        d = SHARE / g["slug"]
        d.mkdir(parents=True, exist_ok=True)
        (d / "index.html").write_text(SHARE_PAGE.format(
            name=html.escape(g["name"]), desc=html.escape(desc), slug=g["slug"],
            url=f"{SITE_URL}/g/{g['slug']}/", image=f"{SITE_URL}/{urllib.parse.quote(g['cover'])}"), "utf-8")


def pages_only():
    """Перегенерувати лише сторінки-прев'ю з уже зібраного data/nadyhanky.js."""
    s = OUT.read_text("utf-8")
    share_pages(json.loads(s[s.index("{"):s.rindex("}") + 1])["guests"])
    print("Сторінки-прев'ю оновлено")


def add(args):
    sources = json.loads(SOURCES.read_text("utf-8"))
    tg = [re.match(r"https?://t\.me/creanotes/(\d+)", u) for u in args.urls]
    if all(tg):
        posts = [int(m.group(1)) for m in tg]
        if any(set(posts) & set(s.get("posts", [])) for s in sources):
            raise SystemExit("Ця надиханка вже є в data/sources.json")
        entry = {"posts": posts}
    elif len(args.urls) == 1 and "telegra.ph" in args.urls[0]:
        if any(s.get("url") and page_path(s["url"]) == page_path(args.urls[0]) for s in sources):
            raise SystemExit("Ця надиханка вже є в data/sources.json")
        entry = {"url": args.urls[0]}
    else:
        raise SystemExit("Дайте одне посилання на telegra.ph або посилання на пости t.me/creanotes/…")
    entry["slug"] = args.slug or re.sub(r"[^a-z0-9]+", "-", translit(args.name).lower()).strip("-")
    entry["name"] = args.name
    entry["role"] = args.role or ""
    if args.intro:
        entry["intro"] = args.intro
    sources.append(entry)
    SOURCES.write_text(json.dumps(sources, ensure_ascii=False, indent=2) + "\n", "utf-8")
    build()


TR = dict(zip("абвгґдеєжзиіїйклмнопрстуфхцчшщьюяʼ'", ["a", "b", "v", "h", "g", "d", "e", "ie", "zh", "z", "y", "i", "i", "i", "k", "l", "m", "n", "o", "p", "r", "s", "t", "u", "f", "kh", "ts", "ch", "sh", "shch", "", "iu", "ia", "", ""]))


def translit(s):
    return "".join(TR.get(ch.lower(), ch) for ch in s)


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd")
    a = sub.add_parser("add", help="додати нову надиханку")
    a.add_argument("urls", nargs="+", metavar="url",
                   help="посилання на telegra.ph або на пост(и) каналу t.me/creanotes/… по порядку")
    a.add_argument("--name", required=True, help="ім'я в називному відмінку")
    a.add_argument("--role", help="коротко, хто це")
    a.add_argument("--intro", help="вступ, якщо його немає на telegra.ph (абзаци через порожній рядок)")
    a.add_argument("--slug", help="адреса сторінки латиницею, напр. maksym-lesniak")
    sub.add_parser("pages", help="лише перегенерувати сторінки-прев'ю g/<slug>/ для шерингу")
    args = ap.parse_args()
    if args.cmd == "add":
        add(args)
    elif args.cmd == "pages":
        pages_only()
    else:
        build()
