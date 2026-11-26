import { useEffect, useRef, useState } from 'react';
import ChampionCard from './ChampionCard.jsx';
import { TAG_KO, iconUrl, loadChampionDetail, matchName } from '../lol/api.js';

/*
    도감 화면: 왼쪽 검색·필터·아이콘 목록 + 오른쪽 챔피언 카드
    index(몇 번째 챔피언인지)는 App 이 가지고 있다. 퀴즈·추리 게임에서 "도감에서 보기"를 누르면 App 이 index 를 바꾼다.
*/
export default function Dex({champions, factions, index, setIndex}) {

    const [champion, setChampion] = useState(null);   // 현재 챔피언 상세 정보
    const [search, setSearch] = useState('');         // 검색창에 입력한 글자
    const [role, setRole] = useState('');             // 선택한 역할 ('' = 전체)
    const [region, setRegion] = useState('');         // 선택한 지역 ('' = 전체)

    // useRef: 화면에 그려진 DOM 요소(오른쪽 카드 영역)를 가리킨다. 값이 바뀌어도 다시 렌더링되지 않는다.
    const mainRef = useRef(null);

    const current = champions[index];
    const champId = current.id;
    const faction = factions && current.faction ? factions[current.faction] : null;

    // 검색어·역할·지역 세 조건을 모두 만족하는 챔피언만 남긴다.
    const filtered = champions.filter(c =>
        matchName(c, search)
        && (role === '' || c.tags.includes(role))
        && (region === '' || c.faction === region)
    );

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

    // 검색창에서 엔터를 누르면 첫 번째 검색 결과를 보여준다.
    function handleSubmit(e) {
        e.preventDefault();
        if (filtered.length > 0) selectChampion(filtered[0]);
    }

    // 선택된 챔피언이 바뀔 때마다 상세 정보(스킬·스킨 + 유니버스 스토리)를 요청한다.
    useEffect(() => {
        let ignore = false;
        loadChampionDetail(champId)
            .then(data => { if (!ignore) setChampion(data); })
            .catch(() => { if (!ignore) setChampion({id: champId, failed: true}); });
        // 버튼을 빠르게 눌러 이전 요청이 늦게 도착하면 무시한다.
        return () => { ignore = true; };
    }, [champId]);

    return (
        <div className="layout">
            <aside className="sidebar">
                <div className="panel nav">
                    <button className="btn" onClick={() => setIndex(index - 1)} disabled={index === 0}>← 이전</button>
                    <span className="pos"><b>{index + 1}</b> / {champions.length}</span>
                    <button className="btn" onClick={() => setIndex(index + 1)} disabled={index === champions.length - 1}>다음 →</button>
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

                    <div className="filter-label">역할</div>
                    <div className="chips">
                        {['', ...Object.keys(TAG_KO)].map(tag => (
                            <button key={tag || 'all'} className={role === tag ? 'chip active' : 'chip'} onClick={() => setRole(tag)}>
                                {tag === '' ? '전체' : TAG_KO[tag]}
                            </button>
                        ))}
                    </div>

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

                <div className="panel grid-panel">
                    <div className="champ-grid">
                        {filtered.length === 0 && <p className="muted empty">검색 결과가 없습니다.</p>}
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

            <main ref={mainRef} className="dex-main">
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
    );
}
