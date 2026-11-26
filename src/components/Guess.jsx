import { useEffect, useMemo, useState } from 'react';
import { TAG_KO, iconUrl, matchName, splashUrl } from '../lol/api.js';

/*
    챔피언 추리 게임
    챔피언 이름을 하나씩 넣으면, 정답 챔피언과 비교해서 칸마다 색으로 알려준다.
      🟩 같음   🟨 비슷함(역할 일부 같음 / 수치가 가까움)   🟥 다름   ▲▼ 정답 수치가 더 큼/작음
    비교 항목: 지역, 역할, 자원, 기본 사거리, 이동 속도

    모드
      daily   : 오늘의 챔피언. 날짜로 정답을 정해서 같은 날에는 누구나 같은 문제를 푼다. 진행 상황은 localStorage 에 저장한다.
      endless : 무한 모드. 정답을 무작위로 뽑고, 맞히면 새 게임을 시작할 수 있다.
*/

const HINT_TITLE_AT = 4;    // 4번 틀리면 칭호 힌트
const HINT_SPLASH_AT = 7;   // 7번 틀리면 그림 일부 힌트
const DAILY_STORE = 'lol-guess-daily';
const STATS_STORE = 'lol-guess-stats';
const EMPTY_STATS = {dailyStreak: 0, dailyBest: 0, lastDailyWin: null, endlessWins: 0, endlessTries: 0};

// localStorage 는 사생활 보호 모드 등에서 막힐 수 있어서 try/catch 로 감싼다. (막혀도 게임은 된다)
function readStore(key, fallback) {
    try {
        const saved = localStorage.getItem(key);
        return saved ? JSON.parse(saved) : fallback;
    } catch {
        return fallback;
    }
}
function writeStore(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // 저장 실패는 무시
    }
}

// 오늘 날짜를 '2026-11-26' 모양의 글자로 (내 컴퓨터 시간 기준)
function dayKeyOf(date) {
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${m}-${d}`;
}
const todayKey = () => dayKeyOf(new Date());
const yesterdayKey = () => dayKeyOf(new Date(Date.now() - 24 * 60 * 60 * 1000));

// 글자 → 숫자. 같은 글자는 항상 같은 숫자가 나오고, 한 글자만 달라도 숫자가 크게 달라진다. (FNV-1a + 비트 섞기)
function hash(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    h ^= h >>> 16; h = Math.imul(h, 2246822507);
    h ^= h >>> 13; h = Math.imul(h, 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
}

// 오늘의 정답: 영문 id 순으로 줄 세운 뒤(언어와 상관없이 같은 순서) 날짜 숫자로 한 명을 고른다.
function dailyAnswerId(champions, dayKey) {
    const ids = champions.map(c => c.id).sort();
    return ids[hash(`lol-guess-${dayKey}`) % ids.length];
}

function randomId(champions) {
    return champions[Math.floor(Math.random() * champions.length)].id;
}

// 자원 이름 정리: 빈 글자는 '없음', 끝 공백 제거 ('보호막 ' → '보호막')
function resourceOf(c) {
    const p = c.partype.trim();
    return p === '' ? '없음' : p;
}

// 수치 비교: 같으면 ok, near 이내로 가까우면 part, 아니면 no. 화살표는 "정답이 더 크다(▲)/작다(▼)"
function compareNumber(guess, answer, near) {
    if (guess === answer) return {state: 'ok', arrow: ''};
    return {
        state: Math.abs(guess - answer) <= near ? 'part' : 'no',
        arrow: answer > guess ? '▲' : '▼',
    };
}

// 추측한 챔피언(g)과 정답(a)을 항목별로 비교한다.
function compare(g, a) {
    const sameRoles = g.tags.length === a.tags.length && g.tags.every(t => a.tags.includes(t));
    const someRoles = g.tags.some(t => a.tags.includes(t));
    return {
        faction: g.faction === a.faction ? 'ok' : 'no',
        roles: sameRoles ? 'ok' : someRoles ? 'part' : 'no',
        resource: resourceOf(g) === resourceOf(a) ? 'ok' : 'no',
        range: compareNumber(g.stats.attackrange, a.stats.attackrange, 50),
        speed: compareNumber(g.stats.movespeed, a.stats.movespeed, 5),
    };
}

const EMOJI = {ok: '🟩', part: '🟨', no: '🟥'};

// 결과 한 칸. delay 만큼 늦게 뒤집혀서 왼쪽부터 차례로 열리는 느낌을 준다.
function Cell({state, delay, children}) {
    return <div className={`cell ${state}`} style={{animationDelay: `${delay}s`}}>{children}</div>;
}

// 자정까지 남은 시간
function Countdown() {
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);   // 화면에서 사라지면 타이머를 멈춘다.
    }, []);
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const left = Math.max(0, Math.floor((midnight - now) / 1000));
    const pad = n => String(n).padStart(2, '0');
    return <b>{pad(Math.floor(left / 3600))}:{pad(Math.floor(left / 60) % 60)}:{pad(left % 60)}</b>;
}

export default function Guess({champions, factions, onOpen}) {

    const [mode, setMode] = useState('daily');
    const [dayKey, setDayKey] = useState(todayKey);
    // 두 모드의 진행 상황을 한 객체에 담는다. 모드를 바꿔도 각자 이어서 할 수 있다.
    const [games, setGames] = useState(() => {
        const saved = readStore(DAILY_STORE, null);
        return {
            daily: {guesses: saved?.date === todayKey() ? saved.guesses : []},
            endless: {answerId: randomId(champions), guesses: [], gaveUp: false},
        };
    });
    const [stats, setStats] = useState(() => ({...EMPTY_STATS, ...readStore(STATS_STORE, {})}));
    const [input, setInput] = useState('');
    const [copied, setCopied] = useState(false);

    // id 로 챔피언을 바로 찾기 위한 표 { Garen: {...}, Ahri: {...} }
    // useMemo: champions 가 바뀔 때만 다시 만든다. (렌더링마다 173개짜리 객체를 새로 만들지 않도록)
    const byId = useMemo(() => Object.fromEntries(champions.map(c => [c.id, c])), [champions]);

    const game = games[mode];
    const answerId = mode === 'daily' ? dailyAnswerId(champions, dayKey) : game.answerId;
    const answer = byId[answerId];
    const guesses = game.guesses.filter(id => byId[id]);   // 패치로 사라진 챔피언이 저장돼 있으면 뺀다.
    const won = guesses.includes(answerId);
    const gaveUp = mode === 'endless' && game.gaveUp;
    const finished = won || gaveUp;
    const wrong = guesses.length - (won ? 1 : 0);

    // 오늘의 챔피언 진행 상황을 저장한다. (새로고침해도 이어서 풀 수 있다)
    useEffect(() => {
        writeStore(DAILY_STORE, {date: dayKey, guesses: games.daily.guesses});
    }, [dayKey, games.daily.guesses]);

    useEffect(() => {
        writeStore(STATS_STORE, stats);
    }, [stats]);

    // 화면을 켜 둔 채로 자정이 지나면 새 문제로 바꾼다. (30초마다 날짜 확인)
    useEffect(() => {
        const timer = setInterval(() => {
            const key = todayKey();
            if (key !== dayKey) {
                setDayKey(key);
                setGames(prev => ({...prev, daily: {guesses: []}}));
            }
        }, 30 * 1000);
        return () => clearInterval(timer);
    }, [dayKey]);

    // 입력한 글자로 후보 찾기: 이미 넣은 챔피언은 빼고, 이름이 입력한 글자로 시작하는 챔피언을 앞으로
    const keyword = input.trim().toLowerCase();
    const suggestions = keyword === '' ? [] : champions
        .filter(c => !guesses.includes(c.id) && matchName(c, keyword))
        .sort((a, b) => Number(b.name.startsWith(keyword)) - Number(a.name.startsWith(keyword)))
        .slice(0, 8);

    function updateGame(changes) {
        setGames(prev => ({...prev, [mode]: {...prev[mode], ...changes}}));
    }

    function guess(c) {
        if (finished || guesses.includes(c.id)) return;
        const nextGuesses = [...guesses, c.id];
        updateGame({guesses: nextGuesses});
        setInput('');
        setCopied(false);

        if (c.id !== answerId) return;
        // 맞혔을 때 기록 갱신
        setStats(prev => {
            if (mode === 'endless') {
                return {...prev, endlessWins: prev.endlessWins + 1, endlessTries: prev.endlessTries + nextGuesses.length};
            }
            // 어제도 맞혔으면 연속 기록 +1, 아니면 1부터
            const streak = prev.lastDailyWin === yesterdayKey() ? prev.dailyStreak + 1 : 1;
            return {...prev, dailyStreak: streak, dailyBest: Math.max(prev.dailyBest, streak), lastDailyWin: dayKey};
        });
    }

    function handleSubmit(e) {
        e.preventDefault();
        if (suggestions.length > 0) guess(suggestions[0]);
    }

    function newEndless() {
        setGames(prev => ({...prev, endless: {answerId: randomId(champions), guesses: [], gaveUp: false}}));
        setInput('');
    }

    // 결과를 이모지로 복사 (정답 이름은 숨긴다)
    async function copyResult() {
        const lines = guesses.map(id => {
            const r = compare(byId[id], answer);
            return [r.faction, r.roles, r.resource, r.range.state, r.speed.state].map(s => EMOJI[s]).join('');
        });
        const title = mode === 'daily' ? `챔피언 추리 ${dayKey}` : '챔피언 추리 (무한 모드)';
        const text = `${title}\n${guesses.length}번 만에 맞힘\n${lines.join('\n')}`;
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
        } catch {
            setCopied(false);
        }
    }

    const factionName = c => factions?.[c.faction]?.name ?? '?';
    const roleText = c => c.tags.map(t => TAG_KO[t] ?? t).join(' · ');
    // 그림 힌트 위치는 정답마다 고정 (새로고침해도 같은 곳)
    const hintX = 30 + (hash(answerId) % 40);
    const hintY = 15 + (hash(answerId + 'y') % 35);

    if (!answer) return <div className="center-msg">문제를 만들지 못했어요.</div>;

    return (
        <div className="guess">
            <div className="game-top">
                <div>
                    <h2>챔피언 추리</h2>
                    <p className="muted">챔피언을 넣을 때마다 정답과 비교한 결과가 색으로 나와요.</p>
                </div>
                <div className="score">
                    {mode === 'daily' ? (
                        <>
                            <div><small>연속 성공</small><b>{stats.dailyStreak}</b></div>
                            <div><small>최고 기록</small><b>{stats.dailyBest}</b></div>
                        </>
                    ) : (
                        <>
                            <div><small>맞힌 판</small><b>{stats.endlessWins}</b></div>
                            <div><small>평균 시도</small><b>{stats.endlessWins ? (stats.endlessTries / stats.endlessWins).toFixed(1) : '-'}</b></div>
                        </>
                    )}
                </div>
            </div>

            <div className="mode-switch">
                <button className={mode === 'daily' ? 'chip active' : 'chip'} onClick={() => setMode('daily')}>오늘의 챔피언</button>
                <button className={mode === 'endless' ? 'chip active' : 'chip'} onClick={() => setMode('endless')}>무한 모드</button>
                <span className="muted small">{mode === 'daily' ? `${dayKey} · 하루 한 문제` : '맞힐 때마다 새 문제'}</span>
            </div>

            {finished ? (
                <div className="panel win">
                    <div className="win-art" style={{backgroundImage: `url("${splashUrl(answer.id)}")`}}>
                        <div className="win-text">
                            <p className="eyebrow">{won ? `${guesses.length}번 만에 정답!` : '정답은'}</p>
                            <h3>{answer.name}</h3>
                            <p>{answer.title} · {factionName(answer)}</p>
                        </div>
                    </div>
                    <div className="win-actions">
                        {mode === 'daily' && <span className="muted small">다음 챔피언까지 <Countdown/></span>}
                        <div className="row-gap">
                            {won && <button className="btn" onClick={copyResult}>{copied ? '복사했어요 ✓' : '결과 복사'}</button>}
                            <button className="btn" onClick={() => onOpen(answer)}>도감에서 보기</button>
                            {mode === 'endless' && <button className="btn btn-primary" onClick={newEndless}>새 게임</button>}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="panel guess-input">
                    <form className="search" onSubmit={handleSubmit}>
                        <span className="muted">⌕</span>
                        <input
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            placeholder="챔피언 이름을 입력하고 엔터"
                            autoComplete="off"
                        />
                        <span className="count">{guesses.length}번째 시도</span>
                    </form>
                    {suggestions.length > 0 && (
                        <ul className="suggest">
                            {suggestions.map(c => (
                                <li key={c.id}>
                                    <button type="button" onClick={() => guess(c)}>
                                        <img src={iconUrl(c)} alt=""/>
                                        <span>{c.name}</span>
                                        <small>{c.enName}</small>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                    <div className="row-gap hints">
                        {wrong >= HINT_TITLE_AT
                            ? <span className="hint">칭호 · “{answer.title}”</span>
                            : <span className="hint locked">칭호 힌트: {HINT_TITLE_AT - wrong}번 더 틀리면 열려요</span>}
                        {wrong < HINT_SPLASH_AT && <span className="hint locked">그림 힌트: {HINT_SPLASH_AT - wrong}번 더 틀리면 열려요</span>}
                        {mode === 'endless' && guesses.length > 0 && (
                            <button className="btn small-btn" onClick={() => updateGame({gaveUp: true})}>포기하고 정답 보기</button>
                        )}
                    </div>
                    {wrong >= HINT_SPLASH_AT && (
                        <div className="zoom hint-zoom">
                            <img src={splashUrl(answer.id)} alt="그림 힌트" style={{transformOrigin: `${hintX}% ${hintY}%`, transform: 'scale(3.4)'}}/>
                        </div>
                    )}
                </div>
            )}

            {guesses.length > 0 && (
                <div className="board">
                    <div className="board-head">
                        <span>챔피언</span><span>지역</span><span>역할</span><span>자원</span><span>사거리</span><span>이동 속도</span>
                    </div>
                    {/* 최근에 넣은 챔피언이 위로 오도록 뒤집는다. (reverse 는 원본을 바꾸므로 복사본에서) */}
                    {[...guesses].reverse().map(id => {
                        const g = byId[id];
                        const r = compare(g, answer);
                        return (
                            <div className="board-row" key={id}>
                                <div className="cell champ-cell">
                                    <img src={iconUrl(g)} alt=""/>
                                    <span>{g.name}</span>
                                </div>
                                <Cell state={r.faction} delay={0.1}>{factionName(g)}</Cell>
                                <Cell state={r.roles} delay={0.25}>{roleText(g)}</Cell>
                                <Cell state={r.resource} delay={0.4}>{resourceOf(g)}</Cell>
                                <Cell state={r.range.state} delay={0.55}>{g.stats.attackrange} {r.range.arrow}</Cell>
                                <Cell state={r.speed.state} delay={0.7}>{g.stats.movespeed} {r.speed.arrow}</Cell>
                            </div>
                        );
                    })}
                </div>
            )}

            <div className="legend muted small">
                <span><i className="dot ok"/>같음</span>
                <span><i className="dot part"/>비슷함 (역할 일부 같음 · 사거리 ±50 · 이동 속도 ±5)</span>
                <span><i className="dot no"/>다름</span>
                <span>▲▼ 정답 수치가 더 큼/작음</span>
            </div>
        </div>
    );
}
