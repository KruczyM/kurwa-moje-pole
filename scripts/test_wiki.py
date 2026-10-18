import urllib.request
import urllib.parse
import json

query = urllib.parse.quote("Pol'and'Rock Festival ASP")
url = f"https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch={query}&utf8=&format=json&srnamespace=6"
req = urllib.request.Request(url, headers={'User-Agent': 'CoolBot/1.0'})
response = urllib.request.urlopen(req).read().decode('utf-8')
data = json.loads(response)
print(data)
