import json, os, re, sys
from html.parser import HTMLParser

SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "01_Abstract", "Q-DRIFT_Abstract.html")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "abstract.json")
VOID = {"br", "img", "meta", "link", "hr", "input"}


class Node:
    def __init__(self, tag, attrs, parent=None):
        self.tag, self.attrs, self.parent, self.children = tag, dict(attrs), parent, []

    @property
    def cls(self):
        return (self.attrs.get("class") or "").split()


class Tree(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = Node("root", [])
        self.cur = self.root
        self.skip = 0

    def handle_starttag(self, tag, attrs):
        if tag in ("style", "script", "title", "head"):
            self.skip += 1
            return
        n = Node(tag, attrs, self.cur)
        self.cur.children.append(n)
        if tag not in VOID:
            self.cur = n

    def handle_startendtag(self, tag, attrs):
        if tag in ("style", "script", "title", "head"):
            return
        self.cur.children.append(Node(tag, attrs, self.cur))

    def handle_endtag(self, tag):
        if tag in ("style", "script", "title", "head"):
            self.skip = max(0, self.skip - 1)
            return
        n = self.cur
        while n is not self.root and n.tag != tag:
            n = n.parent
        if n is not self.root:
            self.cur = n.parent

    def handle_data(self, data):
        if self.skip:
            return
        self.cur.children.append(data)


def runs_of(node, style=None, out=None):
    """flatten inline content to runs; whitespace is collapsed later"""
    style = style or {}
    out = [] if out is None else out
    for ch in node.children:
        if isinstance(ch, str):
            out.append(dict(style, t=ch))
        elif ch.tag == "br":
            out.append({"br": True})
        else:
            s = dict(style)
            if ch.tag in ("b", "strong"):
                s["b"] = True
            elif ch.tag in ("i", "em"):
                s["i"] = True
            elif ch.tag == "sub":
                s["sub"] = True
            elif ch.tag == "sup":
                s["sup"] = True
            elif ch.tag == "small":
                s["small"] = True
            runs_of(ch, s, out)
    return out


def clean(runs):
    res, last_space = [], True
    for r in runs:
        if r.get("br"):
            if res and res[-1].get("t", "").endswith(" "):
                res[-1]["t"] = res[-1]["t"].rstrip(" ")
            res.append({"br": True})
            last_space = True
            continue
        t = re.sub(r"\s+", " ", r["t"].replace("\u00a0", "\u00a0"))
        if last_space and t.startswith(" "):
            t = t[1:]
        if not t:
            continue
        last_space = t.endswith(" ")
        res.append(dict(r, t=t))
    while res and res[-1].get("t", "x").endswith(" ") and "t" in res[-1]:
        res[-1]["t"] = res[-1]["t"].rstrip(" ")
        if not res[-1]["t"]:
            res.pop()
        else:
            break
    return res


def text_of(node):
    return "".join(c if isinstance(c, str) else text_of(c) for c in node.children)


def pct_widths(cells):
    ws = []
    for c in cells:
        m = re.search(r"width:\s*([\d.]+)%", c.attrs.get("style", ""))
        ws.append(float(m.group(1)) if m else None)
    known = sum(w for w in ws if w)
    free = [i for i, w in enumerate(ws) if w is None]
    for i in free:
        ws[i] = max(0.0, (100 - known) / len(free))
    return ws


def parse_table(t):
    rows = []
    for tr in iter_tags(t, "tr"):
        row = []
        for c in tr.children:
            if isinstance(c, str) or c.tag not in ("td", "th"):
                continue
            row.append({"th": c.tag == "th", "runs": clean(runs_of(c))})
        rows.append(row)
    first = next(iter_tags(t, "tr"))
    cells = [c for c in first.children if not isinstance(c, str) and c.tag in ("td", "th")]
    ws = pct_widths(cells)
    if "meta" in t.cls:
        ws = [28.0, 72.0]
    return {"type": "table", "cls": t.cls, "widths": ws, "rows": rows}


def iter_tags(node, tag):
    for c in node.children:
        if isinstance(c, str):
            continue
        if c.tag == tag:
            yield c
        elif c.tag in ("thead", "tbody"):
            yield from iter_tags(c, tag)


eq_n = [0]
fig_n = [0]


def blocks_of(node, box=False):
    out = []
    for ch in node.children:
        if isinstance(ch, str):
            continue
        tag, cls = ch.tag, ch.cls
        if tag in ("h1", "h2", "h3"):
            out.append({"type": "h", "level": int(tag[1]), "runs": clean(runs_of(ch)), "box": box})
        elif tag == "p":
            out.append({"type": "p", "cls": cls, "runs": clean(runs_of(ch)), "box": box})
        elif tag in ("ul", "ol"):
            for li in ch.children:
                if not isinstance(li, str) and li.tag == "li":
                    out.append({"type": "li", "ordered": tag == "ol", "runs": clean(runs_of(li)), "cls": ch.cls})
            if tag == "ol":
                out.append({"type": "olend"})
        elif tag == "table":
            out.append(parse_table(ch))
        elif tag == "figure":
            fig_n[0] += 1
            out.append({"type": "fig", "n": fig_n[0]})
        elif tag == "div" and "eq" in cls:
            eq_n[0] += 1
            out.append({"type": "eq", "n": eq_n[0]})
        elif tag == "pre":
            out.append({"type": "pre", "lines": text_of(ch).split("\n")})
        elif tag == "div" and "abstract" in cls:
            out.extend(blocks_of(ch, box=True))
        elif tag == "div" and ("sign" in cls or "sign2" in cls):
            continue
        elif tag == "div":
            out.extend(blocks_of(ch, box))
        elif tag == "body" or tag == "html":
            out.extend(blocks_of(ch, box))
    return out


t = Tree()
t.feed(open(SRC, encoding="utf8").read())
blocks = blocks_of(t.root)
json.dump(blocks, open(OUT, "w", encoding="utf8"), ensure_ascii=False, indent=1)
from collections import Counter
print(Counter(b["type"] for b in blocks))
print("figures:", fig_n[0], "equations:", eq_n[0])
for b in blocks:
    if b["type"] == "h":
        print("H%d" % b["level"], "".join(r.get("t", "") for r in b["runs"]))
