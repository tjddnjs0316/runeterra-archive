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

// 챔피언 선택 대사 (한국어 음성)
// Data Dragon 에는 소리가 없어서, 게임 파일을 공개하는 CommunityDragon 의 파일을 쓴다.
// 파일 이름은 영문 id 가 아니라 숫자 key 이다. (가렌 = 86) key 는 champion.json 에 들어 있다.
export const voiceUrl = c =>
    `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/ko_kr/v1/champion-choose-vo/${c.key}.ogg`;

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

/*
    지역 상세: 소개글, 대표 이미지·영상, 「룬테라 이야기」 같은 영상, 풍경 갤러리, 만화 링크
    modules 배열에 type 별로 섞여 오므로 종류별로 나눠서 돌려준다.
*/
export async function loadFaction(slug) {
    const json = await fetch(`${UNIVERSE}/factions/${slug}/index.json`).then(res => res.json());
    const modules = json.modules ?? [];
    return {
        overview: toParagraphs(json.faction.overview?.short),
        image: json.faction.image?.uri ?? null,
        video: json.faction.video?.uri ?? null,
        videos: modules.filter(m => m.type === 'featured-video' && youtubeId(m.uri)).map(m => ({
            title: m.title,
            description: stripTags(m.description ?? ''),
            youtube: youtubeId(m.uri),
        })),
        galleries: modules.filter(m => m.type === 'image-gallery' && m.assets?.length).map(m => ({
            title: m['section-title'] || '풍경',
            images: m.assets.map(a => ({src: a.uri, caption: a.title})),
        })),
        comics: modules.filter(m => m.type === 'link-out' && m.url).map(m => ({
            title: m.title,
            description: stripTags(m.description ?? ''),
            url: `https://universe.leagueoflegends.com${m.url}`,
            image: m.background?.uri ?? null,
        })),
    };
}

// 유튜브 주소에서 영상 id(11글자)만 뽑는다. watch?v=ID, youtu.be/ID 두 모양 모두
export function youtubeId(url = '') {
    return url.match(/(?:v=|youtu\.be\/)([\w-]{11})/)?.[1] ?? null;
}

// 지역별 단편 소설 목록 (scripts/build-stories.mjs 로 만든 파일)
// 동적 import: 처음 필요할 때 따로 내려받는다. (첫 화면을 가볍게 하려고) 한 번 받으면 다시 받지 않는다.
let storiesPromise = null;
export function loadStories() {
    storiesPromise ??= import('./stories.json').then(m => m.default);
    return storiesPromise;
}

/*
    단편 소설 본문
    story-sections(장) → story-subsections(단락 묶음) → content(HTML) 모양이다.
    <hr> 은 장면이 바뀌는 곳이라 '***' 문단으로 바꿔 둔다.
*/
export async function loadStory(slug) {
    const json = await fetch(`${UNIVERSE}/story/${slug}/index.json`).then(res => res.json());
    return {
        title: json.story.title,
        minutes: json['minutes-to-read'],
        sections: json.story['story-sections'].map(sec => ({
            title: sec.title,
            image: sec['background-image']?.uri ?? null,
            paragraphs: sec['story-subsections']
                // <hr class='story-divider' /> 처럼 속성이 붙어 오기도 해서 <hr ...> 전체를 찾는다.
                .map(sub => sub.content.replace(/<hr[^>]*>/gi, '</p>***</p>'))
                .flatMap(html => toParagraphs(html)),
        })),
    };
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
