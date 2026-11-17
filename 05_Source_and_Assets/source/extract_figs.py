import re, os, subprocess, sys
SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "01_Abstract", "Q-DRIFT_Abstract.html")
OUT = os.path.dirname(os.path.abspath(__file__))
EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
s = open(SRC, encoding='utf8').read()
svgs = re.findall(r'<svg\b.*?</svg>', s, flags=re.S)
print('svgs found:', len(svgs))
for i, svg in enumerate(svgs, 1):
    vb = re.search(r'viewBox="0 0 (\d+) (\d+)"', svg)
    w, h = int(vb.group(1)), int(vb.group(2))
    W = 1520; H = round(W * h / w)
    page = f'<!doctype html><meta charset="utf-8"><style>html,body{{margin:0;background:#fff}}svg{{width:{W}px;height:{H}px;display:block}}</style>{svg}'
    html_path = os.path.join(OUT, f'fig{i}.html')
    open(html_path, 'w', encoding='utf8').write(page)
    png = os.path.join(OUT, f'fig{i}.png')
    if os.path.exists(png): os.remove(png)
    url = 'file:///' + html_path.replace('\\', '/').replace(' ', '%20')
    subprocess.run([EDGE, '--headless=new', '--disable-gpu', '--hide-scrollbars', f'--window-size={W},{H}', f'--screenshot={png}', url], capture_output=True, timeout=90)
    print(i, W, H, os.path.exists(png), os.path.getsize(png) if os.path.exists(png) else 0)
