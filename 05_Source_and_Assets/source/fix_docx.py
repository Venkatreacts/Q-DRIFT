import re, sys, zipfile, shutil, os
src, dst = sys.argv[1], sys.argv[2]
ORDER = ["top", "left", "bottom", "right", "between", "bar"]

def fix_pbdr(m):
    items = {}
    for e in re.findall(r"<w:(?:top|left|bottom|right|between|bar)\b[^>]*/>", m.group(0)):
        items[re.match(r"<w:(\w+)", e).group(1)] = e
    return "<w:pBdr>" + "".join(items[k] for k in ORDER if k in items) + "</w:pBdr>"

tmp = dst + ".tmp"
with zipfile.ZipFile(src) as zin, zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as zout:
    for info in zin.infolist():
        data = zin.read(info.filename)
        if info.filename == "word/document.xml":
            s = data.decode("utf8")
            s, n = re.subn(r"<w:pBdr>.*?</w:pBdr>", fix_pbdr, s, flags=re.S)
            print("pBdr fixed:", n)
            data = s.encode("utf8")
        zout.writestr(info, data)
shutil.move(tmp, dst)
