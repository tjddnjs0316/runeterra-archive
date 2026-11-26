/*
    지역별 단편 소설 목록 만들기  →  src/lol/stories.json
    실행: npm run stories   (새 소설이 나왔을 때 다시 실행하면 된다)

    유니버스에는 "소설 전체 목록" 주소가 없다. 대신 챔피언 페이지마다 그 챔피언이 나오는 소설(story-preview)이 들어 있다.
    그래서 모든 챔피언 페이지를 한 번씩 읽어 소설을 모으고, 등장 챔피언의 소속 지역으로 나눈다.
    소설 본문은 저장하지 않는다. 사이트에서 읽을 때 유니버스에서 바로 받아 온다.
*/
import { writeFile } from 'node:fs/promises';

const UNIVERSE = 'https://universe-meeps.leagueoflegends.com/v1/ko_kr';
const OUT = new URL('../src/lol/stories.json', import.meta.url);

const getJson = url => fetch(url).then(res => {
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    return res.json();
});

// 동시에 limit 개씩만 요청한다. (한꺼번에 수백 개를 보내지 않도록)
async function mapLimit(items, limit, fn) {
    const results = [];
    let next = 0;
    await Promise.all(Array.from({length: limit}, async () => {
        while (next < items.length) {
            const i = next++;
            results[i] = await fn(items[i]).catch(() => null);
        }
    }));
    return results;
}

const search = await getJson(`${UNIVERSE}/search/index.json`);
const factionOf = Object.fromEntries(search.champions.map(c => [c.slug, c['associated-faction-slug'] || 'unaffiliated']));
const champSlugs = search.champions.map(c => c.slug);
console.log(`챔피언 ${champSlugs.length}명 페이지 읽는 중...`);

const pages = await mapLimit(champSlugs, 8, slug => getJson(`${UNIVERSE}/champions/${slug}/index.json`));

const stories = {};
pages.forEach((page, i) => {
    if (!page) return;
    for (const m of page.modules ?? []) {
        if (m.type !== 'story-preview' || !m['story-slug']) continue;
        const slug = m['story-slug'];
        const champs = (m['featured-champions'] ?? []).map(c => c.slug);
        if (champs.length === 0) champs.push(champSlugs[i]);   // 등장 챔피언이 비어 있으면 이 페이지의 챔피언
        const prev = stories[slug];
        stories[slug] = {
            slug,
            title: m.title,
            description: (m.description ?? '').replace(/<[^>]+>/g, '').trim(),
            image: m['featured-image']?.uri ?? m.background?.uri ?? null,
            date: (m['release-date'] ?? '').slice(0, 10),
            champions: [...new Set([...(prev?.champions ?? []), ...champs])],
        };
    }
});

// 소설을 실제로 열 수 있는지 확인하고, 읽는 시간(분)을 가져온다.
const list = Object.values(stories);
console.log(`소설 ${list.length}편 확인 중...`);
const details = await mapLimit(list, 8, s => getJson(`${UNIVERSE}/story/${s.slug}/index.json`));
const ok = [];
list.forEach((s, i) => {
    if (!details[i]) return;   // 열리지 않는 소설은 뺀다.
    s.minutes = details[i]['minutes-to-read'] ?? null;
    s.regions = [...new Set(s.champions.map(c => factionOf[c]).filter(Boolean))];
    ok.push(s);
});
ok.sort((a, b) => b.date.localeCompare(a.date));   // 최신 소설이 앞

await writeFile(OUT, JSON.stringify(ok, null, 1) + '\n');
const count = {};
ok.forEach(s => s.regions.forEach(r => { count[r] = (count[r] ?? 0) + 1; }));
console.log(`저장: ${ok.length}편 (열리지 않아 뺀 소설 ${list.length - ok.length}편)`);
console.log(count);
