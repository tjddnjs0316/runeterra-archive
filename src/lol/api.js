/*
    데이터 요청과 공통 도구를 모아 둔 파일
    [Data Dragon] https://developer.riotgames.com/docs/lol#data-dragon : 이름, 칭호, 역할, 스탯, 스킬, 스킨 이미지
    [유니버스]   https://universe.leagueoflegends.com/ko_KR/        : 소속 지역, 지역 소개, 전체 스토리, 대표 대사, 관련 챔피언
                 (공식 문서가 있는 API 는 아니라서, 실패해도 도감은 보이게 만든다.)
*/

const DDRAGON = 'https://ddragon.leagueoflegends.com';
const CDN = `${DDRAGON}/cdn`;
const UNIVERSE = 'https://universe-meeps.leagueoflegends.com/v1/ko_kr';
export const LANG = 'ko_KR';

// 버전: 시작할 때 versions.json 에서 최신 버전을 받아 바꾼다. 요청이 실패하면 이 값을 그대로 쓴다.
// 배포한 뒤에도 패치마다 코드를 고치지 않아도 된다.
let version = '16.23.1';
export async function loadVersion() {
    try {
        const list = await fetch(`${DDRAGON}/api/versions.json`).then(res => res.json());
        version = list[0];
    } catch {
        // 실패하면 기본값 사용
    }
    return version;
}

// 이미지 주소 만들기
export const iconUrl = c => `${CDN}/${version}/img/champion/${c.image.full}`;
export const splashUrl = (id, num = 0) => `${CDN}/img/champion/splash/${id}_${num}.jpg`;
export const loadingUrl = (id, num = 0) => `${CDN}/img/champion/loading/${id}_${num}.jpg`;
export const passiveUrl = file => `${CDN}/${version}/img/passive/${file}`;
export const spellUrl = file => `${CDN}/${version}/img/spell/${file}`;

// tags(역할)는 ko_KR 로 요청해도 영어로 오므로 직접 바꿔준다.
export const TAG_KO = {
    Fighter: '전사', Tank: '탱커', Mage: '마법사',
    Assassin: '암살자', Marksman: '원거리 딜러', Support: '서포터',
};

// 유니버스 주소의 챔피언 이름(slug)은 대부분 Data Dragon id 를 소문자로 바꾼 것과 같다. (Garen -> garen)
// 다른 챔피언만 따로 적어 둔다.
const SLUG_FIX = {Renata: 'renataglasc'};
export function toSlug(id) {
    return SLUG_FIX[id] ?? id.toLowerCase();
}

// 어느 지역에도 속하지 않은 챔피언은 'unaffiliated' 로 온다. 지역 목록에는 없으므로 직접 만든다. (설명은 직접 쓴 글)
const UNAFFILIATED = {
    slug: 'unaffiliated',
    name: '무소속',
    description: '특정 지역에 속하지 않고 룬테라 곳곳을 떠도는 챔피언들이다. 별을 만드는 용, 시간을 다루는 마법사, 세계를 떠도는 방랑자처럼 한 나라의 이야기로 묶을 수 없는 존재들이 여기에 속한다.',
    image: null,
};

// HTML 태그를 지우고 글자만 남긴다.
export function stripTags(text = '') {
    return text.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').trim();
}

// "<p>문단1</p><p>문단2</p>" → ['문단1', '문단2']
export function toParagraphs(html = '') {
    return html.split(/<\/p>/i).map(stripTags).filter(p => p !== '');
}

// 배열을 무작위로 섞은 새 배열 (피셔-예이츠 셔플)
export function shuffle(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

// 이름 검색: 한글 이름 '오공', 영어 이름 'wukong', 영문 id 'monkeyking' 모두 찾는다.
export function matchName(c, keyword) {
    const k = keyword.trim().toLowerCase();
    return c.name.toLowerCase().includes(k)
        || c.enName.toLowerCase().includes(k)
        || c.id.toLowerCase().includes(k);
}

/*
    전체 목록 요청: 한글 목록, 영어 목록, 유니버스 목록을 Promise.all 로 동시에 요청한다.
    돌려주는 값
      champions : 한글 가나다순 배열. 각 챔피언에 enName(영어 이름), slug(유니버스 이름), faction(지역 slug) 이 붙는다.
      factions  : { demacia: { slug, name, description, image }, ... }  (유니버스 실패 시 null)
*/
export async function loadChampionList() {
    await loadVersion();
    const [koJson, enJson, uniJson] = await Promise.all([
        fetch(`${CDN}/${version}/data/${LANG}/champion.json`).then(res => res.json()),
        fetch(`${CDN}/${version}/data/en_US/champion.json`).then(res => res.json()),
        fetch(`${UNIVERSE}/search/index.json`).then(res => res.json()).catch(() => null),
    ]);

    // "챔피언 slug → 지역 slug" 표  { garen: 'demacia', gangplank: 'bilgewater', ... }
    const factionOf = {};
    let factions = null;
    if (uniJson) {
        uniJson.champions.forEach(c => { factionOf[c.slug] = c['associated-faction-slug']; });
        factions = {unaffiliated: UNAFFILIATED};
        uniJson.factions.forEach(f => {
            factions[f.slug] = {
                slug: f.slug,
                name: f.name,
                description: stripTags(f.description),
                image: f.image?.uri,
            };
        });
    }

    const champions = Object.values(koJson.data).map(c => {
        const slug = toSlug(c.id);
        return {
            ...c,
            enName: enJson.data[c.id].name,
            slug,
            faction: uniJson ? (factionOf[slug] || 'unaffiliated') : null,
        };
    });
    champions.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    return {champions, factions};
}

// 챔피언 상세 (스킬·스킨)만 요청
export async function loadChampionData(id) {
    const json = await fetch(`${CDN}/${version}/data/${LANG}/champion/${id}.json`).then(res => res.json());
    return json.data[id];
}

// 챔피언 상세 + 유니버스 스토리를 동시에 요청해서 하나로 합친다.
export async function loadChampionDetail(id) {
    const [data, uniJson] = await Promise.all([
        loadChampionData(id),
        fetch(`${UNIVERSE}/champions/${toSlug(id)}/index.json`).then(res => res.json()).catch(() => null),
    ]);
    return {
        ...data,
        story: uniJson?.champion ?? null,
        related: uniJson?.['related-champions'] ?? [],
    };
}
