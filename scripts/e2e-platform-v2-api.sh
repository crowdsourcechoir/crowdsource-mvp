#!/usr/bin/env bash
# API e2e for Platform V2 community spine against local Next (USE_LOCAL_EVENTS=true).
set -euo pipefail
BASE="${BASE:-http://localhost:3000}"
LOG="/opt/cursor/artifacts/platform-v2-api-e2e.log"
exec > >(tee "$LOG") 2>&1

echo "== Create Populus-style garden =="
CREATE=$(curl -sS -X POST "$BASE/api/gardens" \
  -H 'Content-Type: application/json' \
  -d '{"slug":"populus-v2-spine","title":"Populus Thresholds R&D","status":"live"}')
echo "$CREATE" | head -c 500; echo
GID=$(node -e "const j=JSON.parse(process.argv[1]); console.log(j.garden?.id||j.id||'')" "$CREATE")
test -n "$GID"
echo "gardenId=$GID"

echo "== PATCH community settings (account_required + audience) =="
curl -sS -X PATCH "$BASE/api/gardens/$GID/community" \
  -H 'Content-Type: application/json' \
  -d '{"identityMode":"account_required","reachableAudience":400,"campaignLabel":"Populus Thresholds R&D","populusPilot":true}' | tee /tmp/p2-settings.json
echo

echo "== Upsert blocked without claim (device present) =="
CODE=$(curl -sS -o /tmp/p2-block.json -w '%{http_code}' -X POST "$BASE/api/gardens/$GID/community/contributions" \
  -H 'Content-Type: application/json' \
  -d '{"action":"upsert","sourceType":"turn","sourceId":"turn-api-1","deviceId":"dev_api_ada","kind":"lyric","creditName":"Ada","excerpt":"threshold"}')
echo "status=$CODE body=$(cat /tmp/p2-block.json)"
test "$CODE" = "403"

echo "== Claim identity =="
curl -sS -X POST "$BASE/api/gardens/$GID/community/claim" \
  -H 'Content-Type: application/json' \
  -d '{"deviceId":"dev_api_ada","displayName":"Ada Lovelace","email":"ada@populus.test"}' | tee /tmp/p2-claim.json
echo

echo "== Upsert contribution =="
curl -sS -X POST "$BASE/api/gardens/$GID/community/contributions" \
  -H 'Content-Type: application/json' \
  -d '{"action":"upsert","sourceType":"turn","sourceId":"turn-api-1","deviceId":"dev_api_ada","kind":"lyric","creditName":"Ada Lovelace","excerpt":"We rise at the threshold","rights":{"publicDisplay":true,"showUse":true,"socialPosting":true,"sponsorUse":true}}' | tee /tmp/p2-upsert.json
echo

echo "== Select (Composer seam) =="
curl -sS -X POST "$BASE/api/gardens/$GID/community/contributions" \
  -H 'Content-Type: application/json' \
  -d '{"action":"select","sourceType":"turn","sourceId":"turn-api-1"}' | tee /tmp/p2-select.json
echo

echo "== Claim second device + react =="
curl -sS -X POST "$BASE/api/gardens/$GID/community/claim" \
  -H 'Content-Type: application/json' \
  -d '{"deviceId":"dev_api_bob","displayName":"Bob","email":"bob@populus.test"}' >/dev/null
curl -sS -X POST "$BASE/api/gardens/$GID/community/contributions/turn/turn-api-1/react" \
  -H 'Content-Type: application/json' \
  -d '{"deviceId":"dev_api_bob"}' | tee /tmp/p2-react.json
echo

echo "== Perform (Live seam) =="
curl -sS -X POST "$BASE/api/gardens/$GID/community/contributions" \
  -H 'Content-Type: application/json' \
  -d '{"action":"perform","sourceType":"turn","sourceId":"turn-api-1"}' | tee /tmp/p2-perform.json
echo

echo "== Discover selected + credits =="
curl -sS "$BASE/api/gardens/$GID/community/contributions?selected=1" | tee /tmp/p2-discover.json
echo

echo "== Credit pack =="
curl -sS "$BASE/api/gardens/$GID/community/credit-pack" | tee /tmp/p2-pack.json
echo

echo "== Index =="
curl -sS "$BASE/api/gardens/$GID/community/index" | tee /tmp/p2-index.json
echo

node <<'NODE'
const fs = require('fs');
const discover = JSON.parse(fs.readFileSync('/tmp/p2-discover.json','utf8'));
const pack = JSON.parse(fs.readFileSync('/tmp/p2-pack.json','utf8'));
const index = JSON.parse(fs.readFileSync('/tmp/p2-index.json','utf8')).index;
if (!discover.contributions?.length) throw new Error('expected selected contributions');
if (!discover.credits?.some(c => c.creditName === 'Ada Lovelace')) throw new Error('missing in-garden credit');
const entry = pack.pack.entries.find(e => e.sourceId === 'turn-api-1');
if (!entry) throw new Error('missing pack entry');
for (const k of ['selected','performed','amplified']) {
  if (!entry.recognition.includes(k)) throw new Error('missing recognition '+k);
}
if (index.contributors < 1) throw new Error('contributors');
if (index.reachableAudience !== 400) throw new Error('audience');
if (index.participationRate !== index.contributors / 400) throw new Error('rate');
if (index.sponsoredParticipationVolume < 2) throw new Error('volume');
if (index.activationReach < 1) throw new Error('activation');
console.log('API e2e assertions passed');
console.log(JSON.stringify({
  participationRate: index.participationRate,
  sponsoredParticipationVolume: index.sponsoredParticipationVolume,
  activationReach: index.activationReach,
  credits: discover.credits.map(c => c.creditName),
}, null, 2));
NODE

echo "GID=$GID" > /opt/cursor/artifacts/platform-v2-garden-id.txt
echo "ALL API E2E OK garden=$GID"
