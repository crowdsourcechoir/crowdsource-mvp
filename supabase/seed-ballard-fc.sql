npm warn exec The following package was not found and will be installed: tsx@4.23.12
-- Ballard FC Song Garden demo seed (idempotent upsert by slug)
insert into public.gardens (
  slug, title, kind, status, brand_kit, world_state, world_version, mutation_policy, commerce
) values (
  'ballard-fc',
  'Ballard FC Song Garden',
  'season',
  'live',
  '{"title":"Ballard FC","logoUrl":"/fans/ballard-fc/logo.png","primaryColor":"#0B1F3A","accentColor":"#CFFF81","heroArtworkUrl":"/fans/ballard-fc/interbay-stadium-map.jpg","animationPreset":"particles","ambientSoundtrackUrl":null,"bloomStoryboard":[],"zones":[{"key":"supporters","label":"Supporters","sponsorKey":null,"x":0.7,"y":0.2,"blurb":"Loudest end — leave a mark with the ultras."},{"key":"beer-garden","label":"Beer Garden","sponsorKey":"stoup","x":0.88,"y":0.3,"blurb":"Service Station #1 — Stoup sideline energy."},{"key":"tequila-zone","label":"Tequila Zone","sponsorKey":"orgullo-ajeno","x":0.88,"y":0.55,"blurb":"21+ corner — Orgullo Ajeno."},{"key":"standing-room","label":"Standing Room","sponsorKey":null,"x":0.3,"y":0.22,"blurb":"On your feet along the north stand."},{"key":"family","label":"Family Section","sponsorKey":null,"x":0.42,"y":0.22,"blurb":"Alcohol-free GA — bring the kids."},{"key":"merch-tent","label":"Merch Tent","sponsorKey":null,"x":0.22,"y":0.17,"blurb":"Kits, scarves, and matchday gear."},{"key":"pagliacci-pitch","label":"Pagliacci Pitch","sponsorKey":"pagliacci","x":0.48,"y":0.52,"blurb":"Center circle — the shared Song Garden heart."},{"key":"south-new","label":"South Stand","sponsorKey":null,"x":0.55,"y":0.86,"blurb":"New / coming seating — claim the south roar."},{"key":"bike-parking","label":"Bike Parking","sponsorKey":"wombi","x":0.18,"y":0.12,"blurb":"Roll up with Wombi."}],"sponsors":[{"key":"pagliacci","name":"Pagliacci Pizza","logoUrl":null,"credit":"Pagliacci Pitch"},{"key":"stoup","name":"Stoup Brewing","logoUrl":null,"credit":"Enabled by Stoup Brewing"},{"key":"orgullo-ajeno","name":"Orgullo Ajeno","logoUrl":null,"credit":"Orgullo Ajeno Tequila"},{"key":"bridges-united","name":"Bridges United Foundation","logoUrl":null,"credit":"Bridges United Foundation"},{"key":"wombi","name":"Wombi","logoUrl":null,"credit":"Wombi Bike Parking"}]}'::jsonb,
  '{"version":0,"updatedAt":"2026-08-10T23:12:39.579Z","energy":0,"totals":{"contributions":0,"participants":0,"byKind":{}},"field":{"nodes":[],"nextIndex":0},"landmarks":[],"layers":{"text":0,"voice":0,"video":0,"percussion":0,"vocal":0,"other":0},"chapters":{"completedIds":[],"activeChapterId":null},"zones":{},"renderSeed":"garden_ballard"}'::jsonb,
  0,
  '{"energyPerContribution":0.012,"energyCap":1,"layerGain":0.02,"layerCap":1,"chapterWeightDefault":1,"betweenChapterWeight":0.5,"chapterFinaleWeight":1.5,"landmarks":[{"key":"north_grove","label":"North Grove","minEnergy":0.2},{"key":"choir_clearing","label":"Choir Clearing","minEnergy":0.45},{"key":"full_bloom","label":"Full Bloom","minEnergy":0.75}],"maxNodes":240,"nodeWeight":1,"deviceDamping":{"windowMinutes":30,"afterCount":5,"factor":0.35}}'::jsonb,
  null
)
on conflict (slug) do update set
  title = excluded.title,
  kind = excluded.kind,
  status = excluded.status,
  brand_kit = excluded.brand_kit,
  mutation_policy = excluded.mutation_policy,
  updated_at = now();

select id, slug, title, status, world_version,
  jsonb_array_length(brand_kit->'zones') as zones,
  jsonb_array_length(brand_kit->'sponsors') as sponsors
from public.gardens where slug = 'ballard-fc';

