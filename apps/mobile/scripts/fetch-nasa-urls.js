/**
 * Run this script to fetch correct NASA image URLs for all Messier objects.
 * Usage: node scripts/fetch-nasa-urls.js
 * 
 * It will output SQL INSERT statements with verified URLs.
 */

const OBJECTS = [
  { id: 'M1', search: 'crab nebula' },
  { id: 'M2', search: 'messier 2 globular' },
  { id: 'M3', search: 'messier 3 globular' },
  { id: 'M4', search: 'messier 4 globular' },
  { id: 'M5', search: 'messier 5 globular' },
  { id: 'M6', search: 'butterfly cluster messier' },
  { id: 'M7', search: 'ptolemy cluster messier 7' },
  { id: 'M8', search: 'lagoon nebula' },
  { id: 'M9', search: 'messier 9 globular' },
  { id: 'M10', search: 'messier 10 globular' },
  { id: 'M11', search: 'wild duck cluster' },
  { id: 'M12', search: 'messier 12 globular' },
  { id: 'M13', search: 'messier 13 hercules globular' },
  { id: 'M14', search: 'messier 14 globular' },
  { id: 'M15', search: 'messier 15 globular' },
  { id: 'M16', search: 'eagle nebula pillars creation' },
  { id: 'M17', search: 'omega nebula swan' },
  { id: 'M20', search: 'trifid nebula' },
  { id: 'M27', search: 'dumbbell nebula' },
  { id: 'M31', search: 'andromeda galaxy' },
  { id: 'M33', search: 'triangulum galaxy' },
  { id: 'M42', search: 'orion nebula' },
  { id: 'M44', search: 'beehive cluster praesepe' },
  { id: 'M45', search: 'pleiades star cluster' },
  { id: 'M51', search: 'whirlpool galaxy' },
  { id: 'M57', search: 'ring nebula' },
  { id: 'M63', search: 'sunflower galaxy' },
  { id: 'M64', search: 'black eye galaxy' },
  { id: 'M81', search: 'bode galaxy messier 81' },
  { id: 'M82', search: 'cigar galaxy messier 82' },
  { id: 'M83', search: 'southern pinwheel galaxy' },
  { id: 'M87', search: 'messier 87 virgo jet' },
  { id: 'M97', search: 'owl nebula' },
  { id: 'M101', search: 'pinwheel galaxy messier 101' },
  { id: 'M104', search: 'sombrero galaxy' },
  { id: 'jupiter', search: 'jupiter planet juno' },
  { id: 'saturn', search: 'saturn planet cassini' },
  { id: 'mars', search: 'mars planet red' },
  { id: 'venus', search: 'venus planet' },
  { id: 'neptune', search: 'neptune planet voyager' },
  { id: 'uranus', search: 'uranus planet' },
  { id: 'mercury', search: 'mercury planet messenger' },
  { id: 'moon', search: 'moon lunar' },
];

async function fetchUrl(query) {
  const encoded = encodeURIComponent(query);
  const res = await fetch(`https://images-api.nasa.gov/search?q=${encoded}&media_type=image&page_size=1`);
  if (!res.ok) return null;
  const data = await res.json();
  const items = data?.collection?.items;
  if (!items || items.length === 0) return null;
  const title = items[0]?.data?.[0]?.title ?? '';
  const links = items[0]?.links;
  if (!links || links.length === 0) return null;
  return { url: links[0].href, title };
}

async function main() {
  console.log('-- NASA Image URLs for Celestial Objects');
  console.log('-- Generated: ' + new Date().toISOString());
  console.log('');
  console.log("INSERT INTO celestial_images (id, name, image_url, credit) VALUES");
  
  const results = [];
  for (const obj of OBJECTS) {
    await new Promise(r => setTimeout(r, 500)); // rate limit
    const result = await fetchUrl(obj.search);
    if (result) {
      results.push(`  ('${obj.id}', '${result.title.replace(/'/g, "''")}', '${result.url}', 'NASA')`);
      console.error(`✓ ${obj.id}: ${result.title}`);
    } else {
      console.error(`✗ ${obj.id}: NOT FOUND`);
    }
  }
  
  console.log(results.join(',\n') + ';');
}

main().catch(console.error);
