#!/bin/bash
set -e
PACKAGE="$1"
VERSIONS_URL="https://api.github.com/repos/${GITHUB_REPOSITORY}/packages/container/${PACKAGE}/versions"
AUTH="Authorization: Bearer $GH_TOKEN"
while true; do
  RESP=$(curl -s -H "$AUTH" -H "Accept: application/vnd.github.v3+json" "${VERSIONS_URL}?per_page=100")
  COUNT=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d) if isinstance(d,list) else 0)")
  [ "$COUNT" = "0" ] && break
  echo "Deleting $COUNT versions..."
  echo "$RESP" | python3 -c "
import sys,json,subprocess
data=json.load(sys.stdin)
if not isinstance(data,list): sys.exit(0)
for v in data:
  vid=v['id']
  tags=v.get('metadata',{}).get('container',{}).get('tags',[]) or ['(untagged)']
  print('  Deleting version',vid,':',tags)
  r=subprocess.run(['curl','-s','-X','DELETE','-H','$AUTH','${VERSIONS_URL}/'+str(vid)],capture_output=True,text=True)
  if r.returncode==0: print('    Deleted')
  else: print('    Failed:',r.stdout[:200])
"
done
echo "All versions deleted"