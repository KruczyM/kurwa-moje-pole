import urllib.request
import urllib.parse
import json

url = "https://commons.wikimedia.org/w/api.php?action=query&list=categorymembers&cmtitle=Category:Przystanek_Woodstock&cmlimit=100&cmtype=file&format=json"
req = urllib.request.Request(url, headers={'User-Agent': 'CoolBot/1.0'})
try:
    data = json.loads(urllib.request.urlopen(req).read().decode('utf-8'))
    for item in data['query']['categorymembers']:
        title = item['title']
        if any(w in title.lower() for w in ['mud', 'grzyb', 'water', 'shower', 'błoto']):
            print(title)
except Exception as e:
    print(f"Error: {e}")
