import urllib.request
import urllib.parse
import json
import time

queries = ["Pol'and'Rock Festival Main Stage", "Przystanek Woodstock Main Stage", "Pol'and'Rock Festival ASP", "Przystanek Woodstock ASP"]
results = []

for q in queries:
    query = urllib.parse.quote(q)
    url = f"https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch={query}&utf8=&format=json&srnamespace=6"
    req = urllib.request.Request(url, headers={'User-Agent': 'CoolBot/1.0'})
    try:
        response = urllib.request.urlopen(req).read().decode('utf-8')
        data = json.loads(response)
        for item in data['query']['search']:
            title = item['title']
            if title.lower().endswith(('.jpg', '.jpeg', '.png')):
                results.append(title)
    except Exception as e:
        print(f"Error for {q}: {e}")
    time.sleep(1)

with open('E:/kodowanie/gra/references/titles.json', 'w', encoding='utf-8') as f:
    json.dump(results, f, indent=2, ensure_ascii=False)
print(f"Found {len(results)} titles.")
