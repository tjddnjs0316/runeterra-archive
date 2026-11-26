/*
종합: 리그 오브 레전드 챔피언 도감
07_pokemon과 같은 흐름에, "목록 요청"과 "상세 요청"을 나누는 연습을 더한다.
- state       : 챔피언 목록(champions), 지역 정보(factions), 현재 순서(index), 상세 데이터(champion),
                검색어(search), 역할(role), 지역(region), 화면 모드(mode: 도감/퀴즈)
- event       : 이전/다음 버튼, 아이콘 클릭, 검색 입력(onChange)·엔터(onSubmit), 역할·지역 버튼, 스킨 클릭, 퀴즈 보기 선택
- filter/sort : 검색어·역할·지역에 맞는 챔피언만 골라, 한글 가나다순으로 보여준다.
- useEffect   : 목록은 처음 한 번만 요청 (한글·영어 목록 + 유니버스 목록을 Promise.all 로 동시에)  []
                상세는 챔피언이 바뀔 때마다 요청 (Data Dragon 상세 + 유니버스 스토리를 동시에) [champId]
- props       : 받아온 상세 데이터를 ChampionCard 에, 목록을 Quiz 에 전달
- 반복 렌더링 : 아이콘 목록, 역할(tags), 지역, 스킬(spells), 스킨(skins), 스토리 문단, 관련 챔피언, 퀴즈 보기

[데이터 1] Data Dragon(https://developer.riotgames.com/docs/lol#data-dragon) : 키 없이 쓸 수 있는 라이엇 공식 정적 데이터
  목록 : https://ddragon.leagueoflegends.com/cdn/16.23.1/data/ko_KR/champion.json
  상세 : https://ddragon.leagueoflegends.com/cdn/16.23.1/data/ko_KR/champion/Ahri.json
  → 이름, 칭호, 역할, 스탯, 스킬, 스킨 이미지

[데이터 2] 리그 오브 레전드 유니버스(https://universe.leagueoflegends.com/ko_KR/) 사이트가 쓰는 데이터
  Data Dragon 에는 "어느 지역 소속인지"와 긴 스토리가 없어서, 유니버스 사이트의 데이터를 함께 쓴다.
  목록 : https://universe-meeps.leagueoflegends.com/v1/ko_kr/search/index.json
         → champions[] 에 챔피언별 소속 지역(associated-faction-slug), factions[] 에 지역 13곳의 소개글·이미지
  상세 : https://universe-meeps.leagueoflegends.com/v1/ko_kr/champions/garen/index.json
         → 전체 스토리(biography.full), 대표 대사(quote), 관련 챔피언(related-champions)
  ※ 공식 문서가 있는 API 는 아니다. 사이트가 바뀌면 주소가 달라질 수 있으니, 실패해도 도감은 보이게 만든다.

포켓몬 API와 다른 점
  champion.json 의 data 는 배열이 아니라 객체이다.  { Aatrox: {...}, Ahri: {...}, ... }
  map 으로 반복하려면 Object.values(json.data) 로 배열로 바꿔야 한다.
  번호(1, 2, 3...)가 아니라 영문 id('Ahri')로 상세를 요청한다.
*/
import { useEffect, useRef, useState } from 'react';

const VERSION = '16.23.1';
const LANG = 'ko_KR';   // 'en_US' 로 바꾸면 영어
const CDN = 'https://ddragon.leagueoflegends.com/cdn';
const UNIVERSE = 'https://universe-meeps.leagueoflegends.com/v1/ko_kr';

// tags(역할)는 ko_KR 로 요청해도 영어로 오므로 직접 바꿔준다.
const TAG_KO = {
    Fighter: '전사', Tank: '탱커', Mage: '마법사',
    Assassin: '암살자', Marksman: '원거리 딜러', Support: '서포터',
};

// 유니버스 주소의 챔피언 이름(slug)은 대부분 Data Dragon id 를 소문자로 바꾼 것과 같다. (Garen -> garen, MonkeyKing -> monkeyking)
// 다른 챔피언만 따로 적어 둔다.
const SLUG_FIX = {Renata: 'renataglasc'};
function toSlug(id) {
    return SLUG_FIX[id] ?? id.toLowerCase();
}

// 어느 지역에도 속하지 않은 챔피언은 'unaffiliated' 로 온다.
// 유니버스의 지역 목록(factions)에는 없으므로 직접 만들어 준다. (설명은 라이엇 글이 아니라 직접 쓴 것)
const UNAFFILIATED = {
    slug: 'unaffiliated',
    name: '무소속',
    description: '특정 지역에 속하지 않고 룬테라 곳곳을 떠도는 챔피언들이다. 별을 만드는 용, 시간을 다루는 마법사, 세계를 떠도는 방랑자처럼 한 나라의 이야기로 묶을 수 없는 존재들이 여기에 속한다.',
    image: null,
};

// 스킬 설명·스토리에는 <br>, <p> 같은 HTML 태그가 섞여 있다. 태그를 지우고 글자만 남긴다.
function stripTags(text = '') {
    return text.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').trim();
}

// 스토리는 "<p>문단1</p><p>문단2</p>" 모양이다. </p> 를 기준으로 잘라 문단 배열로 만든다.
function toParagraphs(html = '') {
    return html.split(/<\/p>/i).map(stripTags).filter(p => p !== '');
}

// 배열을 무작위로 섞은 "새 배열"을 돌려준다. (피셔-예이츠 셔플, 원본은 그대로)
function shuffle(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

const iconUrl = c => `${CDN}/${VERSION}/img/champion/${c.image.full}`;
const splashUrl = (id, num = 0) => `${CDN}/img/champion/splash/${id}_${num}.jpg`;

/* ───────────────────────── 스타일 ─────────────────────────
   className 에 쓸 CSS 를 문자열로 만들어 <style> 태그로 넣는다. (파일 하나로 끝내기 위해)
   모든 규칙을 .lol 아래에 두어서 다른 예제 화면에는 영향을 주지 않는다.
*/
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=Noto+Sans+KR:wght@400;500;700;900&display=swap');

.lol {
  --bg: #070b14; --panel: rgba(16, 22, 36, 0.72); --panel-solid: #101624;
  --line: rgba(200, 170, 110, 0.25); --line-soft: rgba(255, 255, 255, 0.08);
  --gold: #c8aa6e; --gold-light: #f0e6d2; --teal: #0ac8b9;
  --text: #e9e7e2; --muted: #8e97aa; --ok: #2fbf71; --danger: #e5484d;
  position: relative; min-height: 100vh; color: var(--text); background: var(--bg);
  font-family: 'Noto Sans KR', system-ui, sans-serif; line-height: 1.6;
}
.lol *, .lol *::before, .lol *::after { box-sizing: border-box; }
.lol ::-webkit-scrollbar { width: 8px; height: 8px; }
.lol ::-webkit-scrollbar-thumb { background: rgba(200, 170, 110, 0.3); border-radius: 8px; }
.lol ::-webkit-scrollbar-track { background: transparent; }
.lol .muted { color: var(--muted); }

/* 배경: 은은한 빛 + 현재 챔피언 그림을 크게 흐리게 깔아 둔다. */
.lol-bg { position: fixed; inset: 0; z-index: 0; pointer-events: none; overflow: hidden;
  background:
    radial-gradient(1200px 600px at 85% -10%, rgba(10, 200, 185, 0.12), transparent 60%),
    radial-gradient(900px 500px at 0% 110%, rgba(200, 170, 110, 0.12), transparent 60%),
    var(--bg); }
.lol-bg img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover;
  filter: blur(56px) saturate(1.3); opacity: 0.22; transform: scale(1.15); animation: lol-fade 0.8s ease; }
.lol-inner { position: relative; z-index: 1; max-width: 1280px; margin: 0 auto; padding: 28px 20px 72px; }
@keyframes lol-fade { from { opacity: 0; } }
@keyframes lol-rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }

/* 머리말 + 탭 */
.lol-header { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 24px; }
.lol-logo small { font-family: 'Cinzel', serif; letter-spacing: 0.32em; color: var(--gold); font-size: 12px; }
.lol-logo h1 { margin: 0; font-size: 30px; font-weight: 900; letter-spacing: -0.02em;
  background: linear-gradient(180deg, var(--gold-light), var(--gold)); -webkit-background-clip: text; background-clip: text; color: transparent; }
.tabs { display: flex; padding: 4px; border: 1px solid var(--line); border-radius: 999px; background: var(--panel); backdrop-filter: blur(12px); }
.tab { border: 0; background: transparent; color: var(--muted); padding: 8px 22px; border-radius: 999px; font: inherit; font-weight: 700; cursor: pointer; transition: 0.2s; }
.tab:hover { color: var(--text); }
.tab.active { background: linear-gradient(180deg, #d4b77c, #a07f45); color: #1a1408; }

/* 공통 버튼 */
.btn { border: 1px solid var(--line); background: rgba(255, 255, 255, 0.04); color: var(--gold-light); padding: 8px 16px; border-radius: 10px; font: inherit; font-weight: 700; cursor: pointer; transition: 0.15s; }
.btn:hover:not(:disabled) { border-color: var(--gold); background: rgba(200, 170, 110, 0.12); }
.btn:disabled { opacity: 0.35; cursor: not-allowed; }
.btn-primary { background: linear-gradient(180deg, #d4b77c, #a07f45); color: #1a1408; border-color: transparent; }
.btn-primary:hover:not(:disabled) { background: linear-gradient(180deg, #e0c48a, #ad8b50); }
.link { color: var(--teal); text-decoration: none; font-size: 13px; font-weight: 500; }
.link:hover { text-decoration: underline; }

/* 도감 레이아웃: 왼쪽 목록 + 오른쪽 카드 */
.layout { display: grid; grid-template-columns: 340px minmax(0, 1fr); gap: 24px; align-items: start; }
.sidebar { position: sticky; top: 16px; display: flex; flex-direction: column; gap: 12px; max-height: calc(100vh - 32px); }
.panel { background: var(--panel); border: 1px solid var(--line-soft); border-radius: 18px; backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); }
.sidebar .panel { padding: 14px; }
.nav { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.nav .pos { color: var(--muted); font-size: 13px; }
.nav .pos b { color: var(--text); }

.search { display: flex; align-items: center; gap: 8px; background: rgba(255, 255, 255, 0.04); border: 1px solid var(--line-soft); border-radius: 12px; padding: 0 12px; transition: border-color 0.2s; }
.search:focus-within { border-color: var(--gold); }
.search input { flex: 1; min-width: 0; background: transparent; border: 0; outline: 0; color: var(--text); font: inherit; padding: 10px 0; }
.search input::placeholder { color: var(--muted); }
.search .count { color: var(--muted); font-size: 12px; white-space: nowrap; }
.icon-btn { border: 0; background: transparent; color: var(--muted); cursor: pointer; font-size: 15px; padding: 0 2px; }
.icon-btn:hover { color: var(--text); }

.filter-label { font-size: 11px; letter-spacing: 0.14em; color: var(--muted); margin: 12px 0 6px; font-weight: 700; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip { border: 1px solid var(--line-soft); background: rgba(255, 255, 255, 0.03); color: var(--text); padding: 3px 10px; border-radius: 999px; font: inherit; font-size: 12px; cursor: pointer; transition: 0.15s; }
.chip:hover { border-color: var(--gold); }
.chip.active { background: var(--gold); border-color: var(--gold); color: #1a1408; font-weight: 700; }
.chip .n { opacity: 0.6; margin-left: 3px; font-size: 11px; }

.grid-panel { flex: 1; min-height: 220px; display: flex; flex-direction: column; overflow: hidden; }
.champ-grid { flex: 1; min-height: 0; overflow-y: auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(62px, 1fr)); gap: 10px 8px; align-content: start; padding: 4px 2px; }
.champ { background: transparent; border: 0; padding: 0; color: inherit; cursor: pointer; text-align: center; font: inherit; min-width: 0; }
.champ img { width: 100%; aspect-ratio: 1; border-radius: 12px; border: 2px solid transparent; display: block; transition: transform 0.15s, border-color 0.15s; }
.champ:hover img { transform: translateY(-2px); border-color: rgba(200, 170, 110, 0.5); }
.champ.active img { border-color: var(--gold); box-shadow: 0 0 0 3px rgba(200, 170, 110, 0.25); }
.champ span { display: block; font-size: 11px; margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.champ.active span { color: var(--gold-light); font-weight: 700; }

/* 챔피언 카드 */
.card { background: var(--panel-solid); border: 1px solid var(--line-soft); border-radius: 20px; overflow: hidden; animation: lol-rise 0.4s ease; box-shadow: 0 30px 80px rgba(0, 0, 0, 0.45); }
.hero { position: relative; aspect-ratio: 1215 / 717; max-height: 540px; width: 100%; overflow: hidden; }
.hero img { width: 100%; height: 100%; object-fit: cover; object-position: center top; display: block; }
.hero-shade { position: absolute; inset: 0; background: linear-gradient(180deg, transparent 35%, rgba(16, 22, 36, 0.6) 68%, var(--panel-solid) 100%); }
.hero-text { position: absolute; left: 28px; right: 28px; bottom: 20px; }
.eyebrow { margin: 0; font-family: 'Cinzel', serif; letter-spacing: 0.25em; color: var(--gold); font-size: 13px; text-transform: uppercase; }
.hero h2 { margin: 2px 0 0; font-size: clamp(32px, 5vw, 54px); font-weight: 900; line-height: 1.1; letter-spacing: -0.02em; text-shadow: 0 2px 24px rgba(0, 0, 0, 0.6); }
.hero-title { margin: 4px 0 12px; color: var(--gold-light); opacity: 0.9; }
.badges { display: flex; flex-wrap: wrap; gap: 6px; }
.badge { padding: 3px 11px; border-radius: 999px; font-size: 12px; background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.16); backdrop-filter: blur(6px); }
.badge.gold { background: rgba(200, 170, 110, 0.22); border-color: rgba(200, 170, 110, 0.65); color: var(--gold-light); font-weight: 700; }

.section { padding: 26px 28px; border-top: 1px solid var(--line-soft); }
.section-title { margin: 0 0 16px; font-size: 13px; letter-spacing: 0.18em; color: var(--gold); font-weight: 700; display: flex; align-items: center; gap: 12px; }
.section-title::after { content: ''; flex: 1; height: 1px; background: linear-gradient(90deg, var(--line), transparent); }
.sub-title { font-size: 14px; margin: 22px 0 10px; color: var(--gold-light); }

.quote { margin: 0 0 20px; padding: 16px 20px; border-left: 3px solid var(--gold); background: linear-gradient(90deg, rgba(200, 170, 110, 0.12), transparent); border-radius: 0 12px 12px 0; font-size: 17px; color: var(--gold-light); }
.quote cite { display: block; margin-top: 6px; font-size: 13px; color: var(--muted); font-style: normal; }

.region { border-radius: 14px; overflow: hidden; margin-bottom: 22px; border: 1px solid var(--line); background: var(--panel-solid) center / cover no-repeat; }
.region-body { padding: 20px 22px; background: linear-gradient(90deg, rgba(7, 11, 20, 0.94) 0%, rgba(7, 11, 20, 0.78) 60%, rgba(7, 11, 20, 0.45) 100%); }
.region-body small { color: var(--gold); letter-spacing: 0.16em; font-size: 11px; font-weight: 700; }
.region-body h4 { margin: 2px 0 8px; font-size: 22px; }
.region-body p { margin: 0 0 10px; color: #cfd3dc; font-size: 14px; max-width: 640px; }

.lore p { margin: 0 0 14px; color: #d4d7de; font-size: 15px; line-height: 1.9; }
.lore.collapsed { position: relative; max-height: 240px; overflow: hidden; }
.lore.collapsed::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 90px; background: linear-gradient(transparent, var(--panel-solid)); }
.related { display: flex; flex-wrap: wrap; gap: 8px; }
.related button { display: flex; align-items: center; gap: 8px; padding: 4px 12px 4px 4px; border-radius: 999px; border: 1px solid var(--line-soft); background: rgba(255, 255, 255, 0.04); color: var(--text); font: inherit; font-size: 13px; cursor: pointer; transition: 0.15s; }
.related button:hover { border-color: var(--gold); }
.related img { width: 28px; height: 28px; border-radius: 50%; }

.bars { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px 28px; }
.bar-row { display: grid; grid-template-columns: 76px 1fr 24px; align-items: center; gap: 10px; font-size: 13px; }
.bar { height: 6px; border-radius: 999px; background: rgba(255, 255, 255, 0.08); overflow: hidden; }
.bar i { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--teal), #6ff0e5); }
.bar-row.gold .bar i { background: linear-gradient(90deg, #a07f45, #f0c674); }
.stats { display: grid; grid-template-columns: repeat(auto-fill, minmax(128px, 1fr)); gap: 10px; margin-top: 20px; }
.stat { padding: 10px 12px; border-radius: 12px; background: rgba(255, 255, 255, 0.03); border: 1px solid var(--line-soft); }
.stat small { display: block; color: var(--muted); font-size: 11px; }
.stat b { font-size: 18px; }

.skills { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.skill { display: flex; gap: 16px; padding: 12px 14px; border-radius: 14px; background: rgba(255, 255, 255, 0.03); border: 1px solid var(--line-soft); }
.skill-icon { position: relative; flex-shrink: 0; align-self: flex-start; }
.skill-icon img { width: 52px; height: 52px; border-radius: 10px; border: 1px solid var(--line); display: block; }
.skill-icon span { position: absolute; right: -6px; bottom: -6px; width: 22px; height: 22px; border-radius: 6px; background: var(--bg); border: 1px solid var(--gold); color: var(--gold); font-size: 11px; font-weight: 900; display: grid; place-items: center; }
.skill strong { font-size: 15px; }
.skill .cd { color: var(--muted); font-size: 12px; margin-left: 8px; font-weight: 400; }
.skill p { margin: 4px 0 0; color: #c4c9d4; font-size: 14px; }

.skins { display: flex; gap: 12px; overflow-x: auto; padding-bottom: 10px; scroll-snap-type: x mandatory; }
.skin { flex-shrink: 0; width: 108px; background: transparent; border: 0; padding: 0; color: var(--text); font: inherit; cursor: pointer; scroll-snap-align: start; text-align: center; }
.skin img { width: 100%; aspect-ratio: 308 / 560; object-fit: cover; border-radius: 12px; border: 2px solid transparent; display: block; transition: 0.15s; }
.skin:hover img { border-color: rgba(200, 170, 110, 0.5); }
.skin.active img { border-color: var(--gold); box-shadow: 0 0 18px rgba(200, 170, 110, 0.35); }
.skin span { display: block; font-size: 12px; margin-top: 6px; line-height: 1.3; color: var(--muted); }
.skin.active span { color: var(--gold-light); }

.center-msg { text-align: center; padding: 90px 20px; color: var(--muted); }
.spinner { width: 34px; height: 34px; margin: 0 auto 14px; border-radius: 50%; border: 3px solid rgba(200, 170, 110, 0.2); border-top-color: var(--gold); animation: lol-spin 0.8s linear infinite; }
@keyframes lol-spin { to { transform: rotate(360deg); } }

/* 퀴즈 */
.quiz { max-width: 780px; margin: 0 auto; }
.quiz-top { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; margin-bottom: 16px; }
.quiz-top h2 { margin: 0; font-size: 24px; }
.quiz-top p { margin: 2px 0 0; font-size: 14px; }
.score { display: flex; gap: 8px; }
.score div { padding: 8px 14px; border-radius: 12px; background: var(--panel); border: 1px solid var(--line-soft); text-align: center; min-width: 76px; }
.score small { display: block; font-size: 11px; color: var(--muted); }
.score b { font-size: 20px; color: var(--gold-light); }
.quiz-card { padding: 24px; animation: lol-rise 0.35s ease; }
.quiz-q { margin: 0 0 4px; color: var(--gold); font-size: 12px; letter-spacing: 0.16em; font-weight: 700; }
.quiz-prompt { margin: 0 0 18px; font-size: 22px; font-weight: 700; }
.zoom { aspect-ratio: 1215 / 717; border-radius: 14px; overflow: hidden; border: 1px solid var(--line); background: #000; }
.zoom img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 1s cubic-bezier(0.2, 0.8, 0.2, 1); }
.big-title { padding: 44px 20px; text-align: center; border-radius: 14px; border: 1px solid var(--line); background: radial-gradient(circle at 50% 0%, rgba(200, 170, 110, 0.2), transparent 70%); font-size: clamp(26px, 5vw, 40px); font-weight: 900; color: var(--gold-light); }
.big-skill { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 32px; border-radius: 14px; border: 1px solid var(--line); background: radial-gradient(circle at 50% 0%, rgba(10, 200, 185, 0.16), transparent 70%); }
.big-skill img { width: 96px; height: 96px; border-radius: 16px; border: 2px solid var(--gold); box-shadow: 0 0 30px rgba(200, 170, 110, 0.3); }
.hint { margin-top: 14px; padding: 10px 14px; border-radius: 10px; background: rgba(10, 200, 185, 0.08); border: 1px dashed rgba(10, 200, 185, 0.45); font-size: 14px; color: #bff3ee; }
.choices { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 18px; }
.choice { padding: 14px 16px; border-radius: 12px; border: 1px solid var(--line-soft); background: rgba(255, 255, 255, 0.04); color: var(--text); font: inherit; font-weight: 700; text-align: left; cursor: pointer; transition: 0.15s; }
.choice small { display: block; color: var(--muted); font-size: 12px; font-weight: 400; }
.choice:hover:not(:disabled) { border-color: var(--gold); background: rgba(200, 170, 110, 0.1); transform: translateY(-1px); }
.choice:disabled { cursor: default; }
.choice.correct { border-color: var(--ok); background: rgba(47, 191, 113, 0.16); }
.choice.wrong { border-color: var(--danger); background: rgba(229, 72, 77, 0.16); }
.choice.dim { opacity: 0.4; }
.result { margin-top: 16px; display: flex; gap: 14px; align-items: center; padding: 12px; border-radius: 14px; background: rgba(255, 255, 255, 0.04); border: 1px solid var(--line-soft); animation: lol-rise 0.3s ease; }
.result img { width: 64px; height: 64px; border-radius: 12px; }
.result h4 { margin: 0; font-size: 18px; }
.result.ok h4 { color: var(--ok); }
.result.no h4 { color: #ff8a8d; }
.result p { margin: 2px 0 0; color: var(--muted); font-size: 13px; }
.quiz-actions { display: flex; gap: 8px; margin-top: 16px; justify-content: flex-end; flex-wrap: wrap; }

@media (max-width: 900px) {
  .layout { grid-template-columns: 1fr; }
  .sidebar { position: static; max-height: none; }
  .grid-panel { max-height: 360px; }
}
@media (max-width: 560px) {
  .lol-inner { padding: 20px 14px 56px; }
  .section { padding: 22px 18px; }
  .hero-text { left: 18px; right: 18px; bottom: 14px; }
  .choices { grid-template-columns: 1fr; }
}
`;

// 모든 화면을 감싸는 틀: 스타일 + 배경 + 가운데 정렬
function Frame({bg, children}) {
    return (
        <div className="lol">
            <style>{CSS}</style>
            {/* key 가 바뀌면 img 를 새로 만들어서 페이드 인 애니메이션이 다시 실행된다. */}
            <div className="lol-bg">{bg && <img key={bg} src={bg} alt=""/>}</div>
            <div className="lol-inner">{children}</div>
        </div>
    );
}

// 스킬 한 줄: 아이콘 + 단축키 + 이름 + (재사용 대기시간) + 설명
function SkillRow({keyName, name, description, imgSrc, cooldown}) {
    return (
        <li className="skill">
            <div className="skill-icon">
                <img src={imgSrc} alt={name}/>
                <span>{keyName}</span>
            </div>
            <div>
                <strong>{name}</strong>
                {/* cooldownBurn 은 레벨별 쿨타임을 "10/9/8/7/6" 처럼 이어 붙인 글자이다. 패시브는 없다. */}
                {cooldown && <span className="cd">⏱ {cooldown}초</span>}
                <p>{stripTags(description)}</p>
            </div>
        </li>
    );
}

// 1~10 점 막대 한 줄
function Bar({label, value, gold}) {
    return (
        <div className={gold ? 'bar-row gold' : 'bar-row'}>
            <span className="muted">{label}</span>
            <div className="bar"><i style={{width: `${value * 10}%`}}/></div>
            <b>{value}</b>
        </div>
    );
}

// 지역 소개 카드: 지역 이미지를 배경으로 깔고 소개글을 보여준다.
function RegionCard({faction}) {
    return (
        <div className="region" style={faction.image ? {backgroundImage: `url("${faction.image}")`} : undefined}>
            <div className="region-body">
                <small>소속 지역</small>
                <h4>{faction.name}</h4>
                <p>{faction.description}</p>
                {faction.slug !== 'unaffiliated' && (
                    <a className="link" href={`https://universe.leagueoflegends.com/ko_KR/region/${faction.slug}/`} target="_blank" rel="noreferrer">
                        유니버스에서 {faction.name} 더 알아보기 ↗
                    </a>
                )}
            </div>
        </div>
    );
}

function ChampionCard({champion, summary, faction, champions, onSelect}) {

    // 지금 크게 보여줄 스킨 번호 (0 = 기본 스킨)
    const [skinNum, setSkinNum] = useState(0);
    // 스토리를 끝까지 펼쳤는지
    const [expanded, setExpanded] = useState(false);

    // skins 에는 크로마(색상 변형)도 섞여 있는데, 크로마는 parentSkin 값이 있고 이미지가 없다.
    // filter 로 이미지가 있는 스킨만 남긴다.
    const skins = champion.skins.filter(skin => skin.parentSkin === undefined);

    // 유니버스 스토리가 있으면 그것을, 실패했으면 Data Dragon 의 짧은 lore 를 보여준다.
    const story = champion.story;
    const paragraphs = story ? toParagraphs(story.biography.full) : [champion.lore];
    const isLong = paragraphs.join('').length > 450;

    // 관련 챔피언(유니버스 slug) 중 도감 목록에 있는 챔피언만 찾아 둔다.
    const related = champion.related
        .map(r => champions.find(c => c.slug === r.slug))
        .filter(Boolean);

    const {stats, info} = champion;

    return (
        <article className="card">
            <div className="hero">
                <img src={splashUrl(champion.id, skinNum)} alt={champion.name}/>
                <div className="hero-shade"/>
                <div className="hero-text">
                    <p className="eyebrow">{summary.enName}</p>
                    <h2>{champion.name}</h2>
                    <p className="hero-title">{champion.title}</p>
                    <div className="badges">
                        {faction && <span className="badge gold">{faction.name}</span>}
                        {champion.tags.map(tag => <span key={tag} className="badge">{TAG_KO[tag] ?? tag}</span>)}
                    </div>
                </div>
            </div>

            <section className="section">
                <h3 className="section-title">세계관</h3>

                {story?.biography.quote && (
                    <blockquote className="quote">
                        {stripTags(story.biography.quote)}
                        <cite>— {story.biography['quote-author'] || champion.name}</cite>
                    </blockquote>
                )}

                {faction && <RegionCard faction={faction}/>}

                <h4 className="sub-title">{champion.name}의 이야기</h4>
                <div className={isLong && !expanded ? 'lore collapsed' : 'lore'}>
                    {/* 문단은 순서가 바뀌지 않으므로 index 를 key 로 써도 괜찮다. */}
                    {paragraphs.map((p, i) => <p key={i}>{p}</p>)}
                </div>
                <div style={{display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap'}}>
                    {isLong && (
                        <button className="btn" onClick={() => setExpanded(prev => !prev)}>
                            {expanded ? '접기' : '이야기 전체 읽기'}
                        </button>
                    )}
                    <a className="link" href={`https://universe.leagueoflegends.com/ko_KR/champion/${summary.slug}/`} target="_blank" rel="noreferrer">
                        유니버스 원문 보기 ↗
                    </a>
                </div>

                {related.length > 0 && (
                    <>
                        <h4 className="sub-title">관련 챔피언</h4>
                        <div className="related">
                            {related.map(c => (
                                <button key={c.id} onClick={() => onSelect(c)}>
                                    <img src={iconUrl(c)} alt=""/>{c.name}
                                </button>
                            ))}
                        </div>
                    </>
                )}
            </section>

            <section className="section">
                <h3 className="section-title">지표</h3>
                {/*
                    info 는 라이엇이 매긴 1~10 점수이다. (게임 클라이언트 챔피언 정보 화면의 막대그래프와 같은 값)
                    attack: 물리 공격 성향, defense: 단단함, magic: 마법 공격 성향, difficulty: 조작 난이도
                */}
                <div className="bars">
                    <Bar label="물리 공격" value={info.attack}/>
                    <Bar label="방어" value={info.defense}/>
                    <Bar label="마법" value={info.magic}/>
                    <Bar label="난이도" value={info.difficulty} gold/>
                </div>
                <div className="stats">
                    <div className="stat"><small>체력</small><b>{stats.hp}</b></div>
                    {stats.mp > 0 && <div className="stat"><small>{champion.partype || '자원'}</small><b>{stats.mp}</b></div>}
                    <div className="stat"><small>공격력</small><b>{stats.attackdamage}</b></div>
                    <div className="stat"><small>방어력</small><b>{stats.armor}</b></div>
                    <div className="stat"><small>마법 저항력</small><b>{stats.spellblock}</b></div>
                    <div className="stat"><small>공격 속도</small><b>{stats.attackspeed}</b></div>
                    <div className="stat"><small>이동 속도</small><b>{stats.movespeed}</b></div>
                    <div className="stat"><small>사거리</small><b>{stats.attackrange}</b></div>
                    {story && <div className="stat"><small>출시일</small><b>{story['release-date'].slice(0, 10)}</b></div>}
                </div>
            </section>

            <section className="section">
                <h3 className="section-title">스킬</h3>
                <ul className="skills">
                    {/* 패시브는 spells 배열에 없고 passive 에 따로 들어있다. */}
                    <SkillRow
                        keyName="P"
                        name={champion.passive.name}
                        description={champion.passive.description}
                        imgSrc={`${CDN}/${VERSION}/img/passive/${champion.passive.image.full}`}
                    />
                    {/* spells 는 Q, W, E, R 순서로 들어있다. */}
                    {champion.spells.map((spell, i) => (
                        <SkillRow
                            key={spell.id}
                            keyName={'QWER'[i]}
                            name={spell.name}
                            description={spell.description}
                            imgSrc={`${CDN}/${VERSION}/img/spell/${spell.image.full}`}
                            cooldown={spell.cooldownBurn}
                        />
                    ))}
                </ul>
            </section>

            <section className="section">
                <h3 className="section-title">스킨 {skins.length}</h3>
                {/* 스킨을 누르면 위의 큰 그림이 그 스킨으로 바뀐다. */}
                <div className="skins">
                    {skins.map(skin => (
                        <button
                            key={skin.id}
                            className={skin.num === skinNum ? 'skin active' : 'skin'}
                            onClick={() => setSkinNum(skin.num)}
                        >
                            <img src={`${CDN}/img/champion/loading/${champion.id}_${skin.num}.jpg`} alt={skin.name} loading="lazy"/>
                            {/* 기본 스킨은 이름이 'default' 로 온다. */}
                            <span>{skin.num === 0 ? '기본' : skin.name}</span>
                        </button>
                    ))}
                </div>
            </section>
        </article>
    );
}

/*
    챔피언 퀴즈
    무작위로 챔피언 4명을 뽑아 보기로 만들고, 그중 한 명을 정답으로 정한다.
    문제 종류
      splash : 스플래시 아트를 크게 확대해서 일부만 보여준다. 정답을 고르면 원래 크기로 줄어든다.
      title  : 칭호만 보여준다. ('데마시아의 힘' → 가렌)
      skill  : 스킬 아이콘만 보여준다. 스킬 정보는 목록에 없어서 이 문제일 때만 상세를 요청한다.
*/
const QUIZ_TYPES = ['splash', 'title', 'skill'];
const QUIZ_LABEL = {splash: '스플래시 아트', title: '칭호', skill: '스킬 아이콘'};

function Quiz({champions, factions, onOpen}) {
    const [question, setQuestion] = useState(null);   // 현재 문제
    const [picked, setPicked] = useState(null);       // 고른 챔피언 id (null = 아직 안 고름)
    const [showHint, setShowHint] = useState(false);
    const [loading, setLoading] = useState(false);
    const [score, setScore] = useState(0);            // 맞힌 개수
    const [total, setTotal] = useState(0);            // 푼 개수
    const [streak, setStreak] = useState(0);          // 연속 정답
    const [best, setBest] = useState(0);              // 최고 연속 정답

    async function nextQuestion() {
        setLoading(true);
        const choices = shuffle(champions).slice(0, 4);               // 보기 4개
        const answer = choices[Math.floor(Math.random() * 4)];        // 그중 하나가 정답
        let type = QUIZ_TYPES[Math.floor(Math.random() * QUIZ_TYPES.length)];

        let spell = null;
        if (type === 'skill') {
            try {
                const res = await fetch(`${CDN}/${VERSION}/data/${LANG}/champion/${answer.id}.json`);
                const json = await res.json();
                const i = Math.floor(Math.random() * 4);   // Q, W, E, R 중 하나
                const s = json.data[answer.id].spells[i];
                spell = {key: 'QWER'[i], name: s.name, img: `${CDN}/${VERSION}/img/spell/${s.image.full}`};
            } catch {
                type = 'title';   // 요청이 실패하면 칭호 문제로 바꾼다.
            }
        }

        setQuestion({
            id: Date.now(),   // 문제마다 다른 값. 확대 그림의 key 로 써서 새 문제마다 img 를 새로 만든다.
            answer, choices, type, spell,
            // 확대할 위치(%). 얼굴이 있는 위쪽 가운데 근처가 나오도록 범위를 좁혔다.
            x: 25 + Math.random() * 50,
            y: 15 + Math.random() * 40,
        });
        setPicked(null);
        setShowHint(false);
        setLoading(false);
    }

    // 처음 한 번 문제를 만든다.
    useEffect(() => {
        nextQuestion();
    }, []);

    function pick(c) {
        if (picked) return;   // 이미 골랐으면 무시
        const correct = c.id === question.answer.id;
        const nextStreak = correct ? streak + 1 : 0;
        setPicked(c.id);
        setTotal(prev => prev + 1);
        if (correct) setScore(prev => prev + 1);
        setStreak(nextStreak);
        setBest(prev => Math.max(prev, nextStreak));
    }

    // 건너뛰면 연속 정답이 끊긴다.
    function skip() {
        setStreak(0);
        nextQuestion();
    }

    if (!question) return <div className="center-msg"><div className="spinner"/>문제를 만드는 중...</div>;

    const {answer, type, spell} = question;
    const revealed = picked !== null;
    const isCorrect = picked === answer.id;
    const regionName = factions?.[answer.faction]?.name ?? '알 수 없음';

    const prompt = {
        splash: '확대된 그림 속 챔피언은 누구일까요?',
        title: '이 칭호를 가진 챔피언은?',
        skill: `이 스킬(${spell?.key})의 주인은?`,
    }[type];

    return (
        <div className="quiz">
            <div className="quiz-top">
                <div>
                    <h2>챔피언 맞히기</h2>
                    <p className="muted">그림 일부, 칭호, 스킬 아이콘을 보고 챔피언을 골라 보세요.</p>
                </div>
                <div className="score">
                    <div><small>정답</small><b>{score}/{total}</b></div>
                    <div><small>연속</small><b>{streak}</b></div>
                    <div><small>최고 연속</small><b>{best}</b></div>
                </div>
            </div>

            <div className="panel quiz-card" key={question.id}>
                <p className="quiz-q">{QUIZ_LABEL[type]}</p>
                <p className="quiz-prompt">{prompt}</p>

                {type === 'splash' && (
                    <div className="zoom">
                        <img
                            key={question.id}
                            src={splashUrl(answer.id)}
                            alt="확대된 스플래시 아트"
                            style={{
                                transformOrigin: `${question.x}% ${question.y}%`,
                                transform: revealed ? 'scale(1)' : 'scale(3.2)',
                            }}
                        />
                    </div>
                )}
                {type === 'title' && <div className="big-title">“{answer.title}”</div>}
                {type === 'skill' && (
                    <div className="big-skill">
                        <img src={spell.img} alt="스킬 아이콘"/>
                        <span className="muted">[{spell.key}] {revealed ? spell.name : '???'}</span>
                    </div>
                )}

                {showHint && !revealed && (
                    <div className="hint">힌트 · {regionName} 소속 · {answer.tags.map(t => TAG_KO[t] ?? t).join(', ')}</div>
                )}

                <div className="choices">
                    {question.choices.map(c => {
                        // 고른 뒤에는 정답은 초록, 내가 고른 오답은 빨강, 나머지는 흐리게
                        let className = 'choice';
                        if (revealed) {
                            if (c.id === answer.id) className += ' correct';
                            else if (c.id === picked) className += ' wrong';
                            else className += ' dim';
                        }
                        return (
                            <button key={c.id} className={className} disabled={revealed} onClick={() => pick(c)}>
                                {c.name}
                                <small>{c.enName}</small>
                            </button>
                        );
                    })}
                </div>

                {revealed && (
                    <div className={isCorrect ? 'result ok' : 'result no'}>
                        <img src={iconUrl(answer)} alt={answer.name}/>
                        <div>
                            <h4>{isCorrect ? '정답이에요!' : `아쉬워요! 정답은 ${answer.name}`}</h4>
                            <p>{answer.title} · {regionName}</p>
                        </div>
                    </div>
                )}

                <div className="quiz-actions">
                    {!revealed && <button className="btn" onClick={() => setShowHint(true)} disabled={showHint}>힌트 보기</button>}
                    {revealed && <button className="btn" onClick={() => onOpen(answer)}>도감에서 보기</button>}
                    <button className="btn btn-primary" onClick={revealed ? nextQuestion : skip} disabled={loading}>
                        {revealed ? '다음 문제' : '건너뛰기'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function Lol() {

const [champions, setChampions] = useState([]);   // 전체 목록 (배열)
const [factions, setFactions] = useState(null);   // 지역 정보 { demacia: {...}, noxus: {...} } (유니버스 실패 시 null)
const [index, setIndex] = useState(0);            // 목록에서 몇 번째 챔피언인지
const [champion, setChampion] = useState(null);   // 현재 챔피언 상세 정보
const [search, setSearch] = useState('');         // 검색창에 입력한 글자
const [role, setRole] = useState('');             // 선택한 역할 ('' = 전체)
const [region, setRegion] = useState('');         // 선택한 지역 ('' = 전체)
const [mode, setMode] = useState('dex');          // 'dex' = 도감, 'quiz' = 퀴즈
const [loadError, setLoadError] = useState(false);

// useRef: 화면에 그려진 DOM 요소(오른쪽 카드 영역)를 가리킨다. 값이 바뀌어도 다시 렌더링되지 않는다.
const mainRef = useRef(null);

// 현재 선택된 챔피언. 목록이 아직 없으면 undefined
const current = champions[index];
const champId = current?.id;

// 검색어가 들어간 챔피언만 남긴다. (한글 이름 '오공', 영어 이름 'wukong', 영문 id 'monkeyking' 모두 검색된다)
// 검색어가 비어 있으면 ''.includes 가 항상 true 이므로 전체 목록이 그대로 남는다.
// 역할·지역을 골랐다면 그 조건도 만족해야 한다. (세 조건을 모두 만족해야 남는다)
const keyword = search.trim().toLowerCase();
const filtered = champions.filter(c => {
    const matchName = c.name.toLowerCase().includes(keyword)
        || c.enName.toLowerCase().includes(keyword)
        || c.id.toLowerCase().includes(keyword);
    const matchRole = role === '' || c.tags.includes(role);
    const matchRegion = region === '' || c.faction === region;
    return matchName && matchRole && matchRegion;
});

// 지역 버튼 목록: 가나다순, '무소속'은 맨 뒤
const regionList = factions
    ? Object.values(factions).sort((a, b) => {
        if (a.slug === 'unaffiliated') return 1;
        if (b.slug === 'unaffiliated') return -1;
        return a.name.localeCompare(b.name, 'ko');
    })
    : [];

// 아이콘·관련 챔피언 클릭 / 엔터: 고른 챔피언이 전체 목록에서 몇 번째인지 찾아 index 로 바꾼다.
function selectChampion(c) {
    setIndex(champions.indexOf(c));
    // 카드 윗부분이 화면 위로 지나가 있으면(아래로 스크롤해서 읽던 중이면) 카드 맨 위로 올려 준다.
    if (mainRef.current && mainRef.current.getBoundingClientRect().top < 0) {
        mainRef.current.scrollIntoView({behavior: 'smooth', block: 'start'});
    }
}

// 퀴즈의 "도감에서 보기": 도감 화면으로 바꾸고 그 챔피언을 고른다.
function openInDex(c) {
    setMode('dex');
    setIndex(champions.indexOf(c));
    window.scrollTo({top: 0, behavior: 'smooth'});
}

// 검색창에서 엔터를 누르면 첫 번째 검색 결과를 보여준다.
function handleSubmit(e) {
    e.preventDefault();   // form 의 기본 동작(새로고침)을 막는다.
    if (filtered.length > 0) selectChampion(filtered[0]);
}

// 1. 목록은 처음 화면이 그려질 때 한 번만 요청한다. (의존성 배열 [])
//    한글 목록, 영어 목록, 유니버스 목록 세 개를 Promise.all 로 동시에 요청한다.
useEffect(() => {
    async function loadChampions() {
        try {
            const [koJson, enJson, uniJson] = await Promise.all([
                fetch(`${CDN}/${VERSION}/data/${LANG}/champion.json`).then(res => res.json()),
                fetch(`${CDN}/${VERSION}/data/en_US/champion.json`).then(res => res.json()),
                // 유니버스는 실패해도 도감은 보여주기 위해 catch 로 null 을 돌려준다.
                fetch(`${UNIVERSE}/search/index.json`).then(res => res.json()).catch(() => null),
            ]);

            // 유니버스 목록에서 "챔피언 slug → 지역 slug" 표를 만든다.  { garen: 'demacia', gangplank: 'bilgewater', ... }
            const factionOf = {};
            let factionMap = null;
            if (uniJson) {
                uniJson.champions.forEach(c => { factionOf[c.slug] = c['associated-faction-slug']; });

                // 지역 정보도 slug 를 키로 하는 객체로 만든다.  { demacia: { name: '데마시아', description, image }, ... }
                factionMap = {unaffiliated: UNAFFILIATED};
                uniJson.factions.forEach(f => {
                    factionMap[f.slug] = {
                        slug: f.slug,
                        name: f.name,
                        description: stripTags(f.description),
                        image: f.image?.uri,
                    };
                });
            }

            // json.data 는 객체이므로 배열로 바꾸고, 영어 이름(enName)·유니버스 slug·소속 지역(faction)을 붙인다.
            // (영어 이름은 id 와 다를 수 있다. 예: id 'MonkeyKing' -> 영어 이름 'Wukong', 'Kaisa' -> "Kai'Sa")
            const list = Object.values(koJson.data).map(c => {
                const slug = toSlug(c.id);
                return {
                    ...c,
                    enName: enJson.data[c.id].name,
                    slug,
                    faction: uniJson ? (factionOf[slug] || 'unaffiliated') : null,
                };
            });

            // 데이터는 영어 id 순서(Aatrox, Ahri ...)로 오므로 한글 가나다순으로 정렬한다.
            list.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
            setFactions(factionMap);
            setChampions(list);
        } catch {
            setLoadError(true);
        }
    }
    loadChampions();
}, []);

// 2. 선택된 챔피언이 바뀔 때마다 상세 정보를 요청한다. (의존성 배열 [champId])
//    Data Dragon 상세(스킬·스킨)와 유니버스 상세(스토리)를 동시에 요청해서 하나로 합친다.
useEffect(() => {
    if (!champId) return;   // 목록이 오기 전에는 요청하지 않는다.

    let ignore = false;
    async function loadChampion() {
        try {
            const [ddJson, uniJson] = await Promise.all([
                fetch(`${CDN}/${VERSION}/data/${LANG}/champion/${champId}.json`).then(res => res.json()),
                fetch(`${UNIVERSE}/champions/${toSlug(champId)}/index.json`).then(res => res.json()).catch(() => null),
            ]);
            if (ignore) return;
            // 상세 응답은 { data: { Ahri: {...} } } 모양이다. 여기에 유니버스 스토리와 관련 챔피언을 붙인다.
            setChampion({
                ...ddJson.data[champId],
                story: uniJson?.champion ?? null,
                related: uniJson?.['related-champions'] ?? [],
            });
        } catch {
            if (!ignore) setChampion({id: champId, failed: true});
        }
    }
    loadChampion();

    // 버튼을 빠르게 눌러 이전 요청이 늦게 도착하면 무시한다.
    return () => { ignore = true; };
}, [champId]);

if (loadError) {
    return <Frame><div className="center-msg">챔피언 목록을 불러오지 못했어요. 인터넷 연결을 확인하고 새로고침해 주세요.</div></Frame>;
}
if (champions.length === 0) {
    return <Frame><div className="center-msg"><div className="spinner"/>챔피언 목록 불러오는 중...</div></Frame>;
}

const faction = factions && current.faction ? factions[current.faction] : null;

return (
    <Frame bg={mode === 'dex' ? splashUrl(champId) : null}>
        <header className="lol-header">
            <div className="lol-logo">
                <small>RUNETERRA ARCHIVE</small>
                <h1>LoL 챔피언 도감</h1>
            </div>
            <nav className="tabs">
                <button className={mode === 'dex' ? 'tab active' : 'tab'} onClick={() => setMode('dex')}>도감</button>
                <button className={mode === 'quiz' ? 'tab active' : 'tab'} onClick={() => setMode('quiz')}>퀴즈</button>
            </nav>
        </header>

        {/*
            퀴즈는 조건부 렌더링({mode === 'quiz' && <Quiz/>}) 대신 hidden 으로 숨긴다.
            조건부 렌더링은 화면에서 빠질 때 컴포넌트를 없애서 점수(state)가 사라지지만,
            hidden 은 보이지만 않을 뿐 컴포넌트가 살아 있어서 도감에 다녀와도 점수가 그대로 남는다.
        */}
        <div hidden={mode !== 'quiz'}>
            <Quiz champions={champions} factions={factions} onOpen={openInDex}/>
        </div>

        {mode === 'dex' && (
            <div className="layout">
                <aside className="sidebar">
                    <div className="panel nav">
                        <button className="btn" onClick={() => setIndex(prev => prev - 1)} disabled={index === 0}>← 이전</button>
                        <span className="pos"><b>{index + 1}</b> / {champions.length}</span>
                        <button className="btn" onClick={() => setIndex(prev => prev + 1)} disabled={index === champions.length - 1}>다음 →</button>
                    </div>

                    <div className="panel">
                        {/* input 이 하나뿐인 form 은 submit 버튼이 없어도 엔터를 누르면 onSubmit 이 실행된다. */}
                        <form className="search" onSubmit={handleSubmit}>
                            <span className="muted">⌕</span>
                            <input
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="챔피언 검색 (예: 오공, wukong)"
                            />
                            {search && <button type="button" className="icon-btn" onClick={() => setSearch('')} aria-label="지우기">✕</button>}
                            <span className="count">{filtered.length}명</span>
                        </form>

                        {/* 역할 버튼: TAG_KO 의 키(Fighter, Tank ...)를 반복해서 버튼으로 만든다. */}
                        <div className="filter-label">역할</div>
                        <div className="chips">
                            {['', ...Object.keys(TAG_KO)].map(tag => (
                                <button key={tag || 'all'} className={role === tag ? 'chip active' : 'chip'} onClick={() => setRole(tag)}>
                                    {tag === '' ? '전체' : TAG_KO[tag]}
                                </button>
                            ))}
                        </div>

                        {/* 지역 버튼: 지역마다 소속 챔피언 수를 함께 보여준다. */}
                        {factions && (
                            <>
                                <div className="filter-label">지역</div>
                                <div className="chips">
                                    <button className={region === '' ? 'chip active' : 'chip'} onClick={() => setRegion('')}>전체</button>
                                    {regionList.map(f => (
                                        <button key={f.slug} className={region === f.slug ? 'chip active' : 'chip'} onClick={() => setRegion(f.slug)}>
                                            {f.name}<span className="n">{champions.filter(c => c.faction === f.slug).length}</span>
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    {/* 가나다순 챔피언 목록. 누르면 그 챔피언으로 이동 */}
                    <div className="panel grid-panel">
                        <div className="champ-grid">
                            {filtered.length === 0 && <p className="muted" style={{gridColumn: '1 / -1', textAlign: 'center'}}>검색 결과가 없습니다.</p>}
                            {filtered.map(c => (
                                <button
                                    key={c.id}
                                    className={c.id === champId ? 'champ active' : 'champ'}
                                    onClick={() => selectChampion(c)}
                                    title={`${c.name} (${c.enName})`}
                                >
                                    <img src={iconUrl(c)} alt={c.name} loading="lazy"/>
                                    <span>{c.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </aside>

                <main ref={mainRef} style={{scrollMarginTop: 16}}>
                    {/* 아직 응답이 오지 않았거나, 이전 챔피언의 데이터라면 로딩 문구를 보여준다. */}
                    {/* key 가 바뀌면 ChampionCard 를 새로 만든다. 다른 챔피언으로 넘어가면 선택한 스킨·펼친 스토리가 처음 값으로 돌아간다. */}
                    {champion?.id !== champId ? (
                        <div className="panel center-msg"><div className="spinner"/>불러오는 중...</div>
                    ) : champion.failed ? (
                        <div className="panel center-msg">상세 정보를 불러오지 못했어요. 다른 챔피언을 눌렀다가 다시 시도해 주세요.</div>
                    ) : (
                        <ChampionCard
                            key={champion.id}
                            champion={champion}
                            summary={current}
                            faction={faction}
                            champions={champions}
                            onSelect={selectChampion}
                        />
                    )}
                </main>
            </div>
        )}
    </Frame>
);

}
