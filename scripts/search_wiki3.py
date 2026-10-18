import urllib.request
import urllib.parse
import json
import os
import time
import socket

socket.setdefaulttimeout(10)

queries = ["Pol'and'Rock Festival Main Stage", "Przystanek Woodstock Main Stage", "Pol'and'Rock Festival ASP", "Przystanek Woodstock ASP", "Pol'and'Rock Festival namiot"]
os.makedirs("E:/kodowanie/gra/references", exist_ok=True)
count = 2 # Start from 2 since 0 and 1 were downloaded
found_images = []

for q in queries:
    if count >= 15: break
    query = urllib.parse.quote(q)
    url = f"https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch={query}&utf8=&format=json&srnamespace=6"
    req = urllib.request.Request(url, headers={'User-Agent': 'CoolBot/1.0 (test@example.com)'})
    try:
        response = urllib.request.urlopen(req).read().decode('utf-8')
        data = json.loads(response)
    except:
        continue
    
    for item in data['query']['search']:
        title = item['title']
        if not title.lower().endswith(('.jpg', '.jpeg', '.png')): continue
        
        title_q = urllib.parse.quote(title)
        img_url = f"https://commons.wikimedia.org/w/api.php?action=query&titles={title_q}&prop=imageinfo&iiprop=url&format=json"
        img_req = urllib.request.Request(img_url, headers={'User-Agent': 'CoolBot/1.0 (test@example.com)'})
        time.sleep(0.5) 
        try:
            img_resp = urllib.request.urlopen(img_req).read().decode('utf-8')
            img_data = json.loads(img_resp)
            pages = img_data['query']['pages']
            for page_id in pages:
                info = pages[page_id].get('imageinfo')
                if info:
                    dl_url = info[0]['url']
                    print(f"Found {dl_url}")
                    found_images.append(dl_url)
                    path = f"E:/kodowanie/gra/references/commons_{count}.jpg"
                    dl_req = urllib.request.Request(dl_url, headers={'User-Agent': 'CoolBot/1.0 (test@example.com)'})
                    with urllib.request.urlopen(dl_req) as dl_resp, open(path, 'wb') as out_file:
                        out_file.write(dl_resp.read())
                    count += 1
        except Exception as e:
            print(f"Error: {e}")
        time.sleep(0.5)
        if count >= 15:
            break

with open('E:/kodowanie/gra/references/found.json', 'w') as f:
    json.dump(found_images, f)
print(f"Downloaded {count} images from Wikimedia.")
