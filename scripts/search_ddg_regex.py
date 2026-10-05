import urllib.request
import urllib.parse
import re

query = urllib.parse.quote('site:pzl24.pl polandrock 2026')
url = f'https://html.duckduckgo.com/html/?q={query}'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
try:
    html = urllib.request.urlopen(req).read().decode('utf-8')
    matches = re.findall(r'href="//duckduckgo\.com/l/\?uddg=([^&]+)', html)
    for m in matches:
        print(urllib.parse.unquote(m))
except Exception as e:
    print(e)
