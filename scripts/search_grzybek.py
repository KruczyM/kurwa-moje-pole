import urllib.request
import urllib.parse
import json

queries = ["Woodstock grzybek", "Przystanek Woodstock grzybek", "Woodstock mud shower", "Pol'and'Rock grzybek", "Woodstock water spray"]
for q in queries:
    url = f"https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch={urllib.parse.quote(q)}&utf8=&format=json&srnamespace=6"
    req = urllib.request.Request(url, headers={'User-Agent': 'CoolBot/1.0'})
    try:
        data = json.loads(urllib.request.urlopen(req).read().decode('utf-8'))
        for item in data['query']['search']:
            print(f"{q} -> {item['title']}")
    except Exception as e:
        print(f"Error {q}: {e}")
