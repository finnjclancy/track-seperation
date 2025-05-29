import json

with open('cookies.json', 'r') as js, open('youtube_cookies.txt', 'w') as out:
    cookies = json.load(js)
    for c in cookies:
        # domain, include_subdomains, path, secure, expiration, name, value
        line = "\t".join([
            c['domain'],
            'TRUE' if not c['hostOnly'] else 'FALSE',
            c['path'],
            'TRUE' if c['secure'] else 'FALSE',
            str(int(c.get('expirationDate', 0))),
            c['name'],
            c['value']
        ])
        out.write(line + "\n")
