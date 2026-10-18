from duckduckgo_search import DDGS
import json
import urllib.request
import os

queries = ["Pol and Rock 2026 duza scena", "Pol and Rock 2026 namiot ASP scena"]

os.makedirs("E:/kodowanie/gra/references", exist_ok=True)

with DDGS() as ddgs:
    for q in queries:
        print(f"Searching images for: {q}")
        results = ddgs.images(q, max_results=10)
        for i, r in enumerate(results):
            url = r.get('image', '')
            if not url: continue
            print(f"Found: {url}")
            try:
                # Basic download
                clean_q = q.replace(' ', '_')
                path = f"E:/kodowanie/gra/references/{clean_q}_{i}.jpg"
                req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(req, timeout=5) as response, open(path, 'wb') as out_file:
                    out_file.write(response.read())
            except Exception as e:
                print(f"Failed to download: {e}")
