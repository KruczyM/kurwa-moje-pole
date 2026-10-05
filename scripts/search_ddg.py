import urllib.request
import urllib.parse
from bs4 import BeautifulSoup
import re

query = urllib.parse.quote('site:pzl24.pl polandrock 2026 foto')
url = f'https://html.duckduckgo.com/html/?q={query}'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    html = urllib.request.urlopen(req).read()
    soup = BeautifulSoup(html, 'html.parser')
    for a in soup.find_all('a', class_='result__url'):
        print(a.get('href'))
except Exception as e:
    print(e)
