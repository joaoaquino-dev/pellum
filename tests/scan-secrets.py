import base64,json,pathlib,re,subprocess
patterns={'private_key':re.compile(rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----'),'github_token':re.compile(rb'gh[pousr]_[A-Za-z0-9]{30,}'),'supabase_secret':re.compile(rb'sb_secret_[A-Za-z0-9_-]{20,}'),'site_credential':re.compile(rb'art_v2_[A-Za-z0-9_]{20,}')}
findings=[];seen=set();count=0
for commit in subprocess.check_output(['git','rev-list','--all']).decode().splitlines():
 for row in subprocess.check_output(['git','ls-tree','-r',commit]).decode().splitlines():
  meta,path=row.split('\t',1);sha=meta.split()[2]
  if sha in seen:continue
  seen.add(sha);data=subprocess.check_output(['git','cat-file','blob',sha]);count+=1
  for kind,p in patterns.items():
   if p.search(data):findings.append({'kind':kind,'path':path,'commit':commit[:12]})
for root in ['standalone/dist','standalone/src','supabase','security']:
 for p in pathlib.Path(root).rglob('*'):
  if not p.is_file():continue
  data=p.read_bytes();count+=1
  for kind,pattern in patterns.items():
   if pattern.search(data):findings.append({'kind':kind,'path':str(p)})
  for m in re.finditer(rb'eyJ[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+',data):
   try:
    payload=json.loads(base64.urlsafe_b64decode(m.group(1)+b'='*((-len(m.group(1)))%4)))
    if payload.get('role')=='service_role':findings.append({'kind':'service_role_jwt','path':str(p)})
   except Exception:pass
result={'scanned_objects_and_files':count,'findings':findings,'note':'Pattern scan, not a guarantee that all secret formats are detected. Publishable Supabase key is intentional.'}
pathlib.Path('security/evidence/secret-scan.json').write_text(json.dumps(result,indent=2))
print(json.dumps(result));raise SystemExit(bool(findings))
