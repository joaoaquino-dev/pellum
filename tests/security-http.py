import json,urllib.request,urllib.error,pathlib
c=json.loads(pathlib.Path('standalone/supabase.public.json').read_text());results=[]
checks=[('anonymous_clinics','/rest/v1/aura_clinics?select=id','GET',None,{401,403}),('anonymous_rpc','/rest/v1/rpc/aura_rpc','POST',{'p_action':'get'},{401,403}),('anonymous_admin','/rest/v1/rpc/aura_admin_rpc','POST',{'p_action':'list'},{401,403}),('private_schema','/rest/v1/licenses?select=email','GET',None,{401,403,404,406}),('storage_bucket_listing','/storage/v1/bucket','GET',None,{200,401,403})]
for name,path,method,body,statuses in checks:
 req=urllib.request.Request(c['url']+path,data=json.dumps(body).encode() if body else None,headers={'apikey':c['publishableKey'],'Content-Type':'application/json'},method=method)
 if name=='private_schema':req.add_header('Accept-Profile','aura_private')
 try:
  with urllib.request.urlopen(req,timeout=15) as r:status=r.status;payload=r.read(10000)
 except urllib.error.HTTPError as e:status=e.code;payload=e.read(10000)
 except Exception as e:results.append({'check':name,'result':'UNVERIFIED','reason':type(e).__name__});continue
 ok=status in statuses
 if name=='storage_bucket_listing' and status==200:
  try:ok=json.loads(payload)==[]
  except Exception:ok=False
 results.append({'check':name,'http_status':status,'result':'PASS' if ok else 'FAIL'})
p=pathlib.Path('security/evidence/http-anonymous.json');p.write_text(json.dumps(results,indent=2));print(json.dumps(results));raise SystemExit(any(r['result']=='FAIL' for r in results))
