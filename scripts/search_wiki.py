import urllib.request
import urllib.parse
import json
import os

queries = ["Pol'and'Rock Festival Main Stage", "Pol'and'Rock Festival ASP", "Przystanek Woodstock Main Stage"]
os.makedirs("E:/kodowanie/gra/references", exist_ok=True)
count = 0

for q in queries:
    query = urllib.parse.quote(q)
    url = f"https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch={query}&utf8=&format=json&srnamespace=6"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    response = urllib.request.urlopen(req).read().decode('utf-8')
    data = json.loads(response)
    
    for item in data['query']['search']:
        title = item['title']
        if not title.lower().endswith(('.jpg', '.jpeg', '.png')): continue
        
        # Get imageinfo
        title_q = urllib.parse.quote(title)
        img_url = f"https://commons.wikimedia.org/w/api.php?action=query&titles={title_q}&prop=imageinfo&iiprop=url&format=json"
        img_req = urllib.request.Request(img_url, headers={'User-Agent': 'Mozilla/5.0'})
        img_resp = urllib.request.urlopen(img_req).read().decode('utf-8')
        img_data = json.loads(img_resp)
        
        pages = img_data['query']['pages']
        for page_id in pages:
            info = pages[page_id].get('imageinfo')
            if info:
                dl_url = info[0]['url']
                print(f"Downloading {dl_url}")
                path = f"E:/kodowanie/gra/references/commons_{count}.jpg"
                dl_req = urllib.request.Request(dl_url, headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(dl_req) as response, open(path, 'wb') as out_file:
                    out_file.write(response.read())
                count += 1
        if count >= 15:
            break
    if count >= 15:
        break
print(f"Downloaded {count} images from Wikimedia.")
