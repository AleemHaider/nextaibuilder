import re, json, sys, urllib.request, urllib.parse, html, time
from html.parser import HTMLParser
BASE='https://nextaibuilder.com'
UA='Mozilla/5.0 (compatible; nab-seo-audit/1.0)'
def get(u):
    req=urllib.request.Request(u,headers={'User-Agent':UA,'Accept-Encoding':'identity'})
    try:
        r=urllib.request.urlopen(req,timeout=30); return r.status, dict(r.headers), r.read().decode('utf-8','replace'), r.geturl()
    except urllib.error.HTTPError as e: return e.code, dict(e.headers), e.read().decode('utf-8','replace'), u
class P(HTMLParser):
    def __init__(s): super().__init__(); s.d={'title':'','metas':{},'links':[],'canon':None,'h':[],'imgs':[],'jsonld':[],'hreflang':[]}; s._t=None; s._buf=''; s._js=False
    def handle_starttag(s,t,a):
        a=dict(a)
        if t=='title': s._t='title'; s._buf=''
        if t=='meta': k=a.get('name') or a.get('property'); 
        if t=='meta' and (a.get('name') or a.get('property')): s.d['metas'][(a.get('name') or a.get('property')).lower()]=a.get('content','')
        if t=='link' and a.get('rel')=='canonical': s.d['canon']=a.get('href')
        if t=='a' and a.get('href'): s.d['links'].append(a['href'])
        if t in ('h1','h2','h3'): s._t=t; s._buf=''
        if t=='img': s.d['imgs'].append({'src':a.get('src',''),'alt':a.get('alt'),'w':a.get('width'),'h':a.get('height'),'loading':a.get('loading')})
        if t=='script' and a.get('type')=='application/ld+json': s._js=True; s._buf=''
    def handle_endtag(s,t):
        if t=='title' and s._t=='title': s.d['title']=s._buf.strip(); s._t=None
        if t in ('h1','h2','h3') and s._t==t: s.d['h'].append((t,re.sub(r'\s+',' ',s._buf).strip())); s._t=None
        if t=='script' and s._js:
            s._js=False
            try: s.d['jsonld'].append(json.loads(s._buf))
            except Exception as e: s.d['jsonld'].append({'_error':str(e)})
    def handle_data(s,x):
        if s._t or s._js: s._buf+=x
seen={}; queue=[BASE+'/']
# seed with sitemap urls
st,hd,body,_=get(BASE+'/wp-sitemap.xml')
sitemaps=re.findall(r'<loc>([^<]+)</loc>',body); smurls=[]
for sm in sitemaps:
    _,_,b,_=get(sm); smurls+=re.findall(r'<loc>([^<]+)</loc>',b)
queue+=smurls
while queue and len(seen)<300:
    u=queue.pop(0); u=u.split('#')[0]
    if u in seen or not u.startswith(BASE): continue
    if re.search(r'\.(png|jpe?g|svg|webp|gif|pdf|xml|css|js|woff2?)$',u) or '/wp-admin' in u or 'add-to-cart' in u or '/feed' in u: continue
    st,hd,body,final=get(u); p=P(); 
    try: p.feed(body)
    except Exception: pass
    words=len(re.sub(r'<[^>]+>',' ',re.sub(r'(?s)<(script|style)[^>]*>.*?</\1>','',body)).split())
    seen[u]={'status':st,'final':final,'title':p.d['title'],'desc':p.d['metas'].get('description'),'robots':p.d['metas'].get('robots'),'canon':p.d['canon'],'og_title':p.d['metas'].get('og:title'),'og_image':p.d['metas'].get('og:image'),'tw':p.d['metas'].get('twitter:card'),'h1':[h for t,h in p.d['h'] if t=='h1'],'h2':[h for t,h in p.d['h'] if t=='h2'][:12],'imgs':p.d['imgs'],'jsonld_types':[ (x.get('@type') if isinstance(x,dict) else None) or [g.get('@type') for g in x.get('@graph',[])] if isinstance(x,dict) else 'list' for x in p.d['jsonld']],'jsonld':p.d['jsonld'],'words':words,'xrobots':hd.get('X-Robots-Tag') or hd.get('x-robots-tag'),'links':len(p.d['links'])}
    for l in p.d['links']:
        l=urllib.parse.urljoin(u,l).split('#')[0]
        if l.startswith(BASE) and l not in seen and l not in queue: queue.append(l)
    time.sleep(0.3)
json.dump({'sitemap_urls':smurls,'pages':seen},open(sys.argv[1],'w'),indent=1,default=str)
print(len(seen),'pages;',len(smurls),'sitemap urls')
