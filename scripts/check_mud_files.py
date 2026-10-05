import urllib.request
import urllib.parse
import json

titles = [
    "File:Woodstock_festival_mud_stage.jpg",
    "File:Woodstock_mud.jpg",
    "File:Woodstock_festival_muds.jpg",
    "File:Woodstock_festival_mud.jpg"
]

for t in titles:
    url = f"https://commons.wikimedia.org/w/api.php?action=query&titles={urllib.parse.quote(t)}&prop=imageinfo&iiprop=url|extmetadata&format=json"
    req = urllib.request.Request(url, headers={'User-Agent': 'CoolBot/1.0'})
    try:
        data = json.loads(urllib.request.urlopen(req).read().decode('utf-8'))
        for pid, page in data['query']['pages'].items():
            info = page.get('imageinfo', [{}])[0]
            desc = info.get('extmetadata', {}).get('ImageDescription', {}).get('value', 'No desc')
            print(f"{t}: {info.get('url')} | {desc[:100]}")
    except Exception as e:
        print(f"Error {t}: {e}")
