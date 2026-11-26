import { useEffect, useState } from 'react';
import { ERAS, TIMELINE } from '../lol/timeline.js';
import { iconUrl, loadStories } from '../lol/api.js';
import { sortRegions } from './Regions.jsx';

/*
    룬테라 연대기
    - 지역 버튼을 여러 개 고를 수 있다. (예: 녹서스 + 아이오니아 → 두 지역의 사건만, 둘 다 얽힌 사건은 "교차" 표시)
    - "이어지는 사건"을 누르면 그 사건으로 스크롤하고 잠깐 빛나게 한다.
    - 사건에 나오는 챔피언과 지역이 같은 단편 소설을 몇 편 붙여 준다.
*/
export default function Timeline({champions, factions, onOpenChampion, onOpenRegion, onOpenStory}) {
    const [selected, setSelected] = useState([]);   // 고른 지역 slug 들 ([] = 전체)
    const [flash, setFlash] = useState(null);       // 잠깐 강조할 사건 id
    const [stories, setStories] = useState([]);

    useEffect(() => {
        loadStories().then(setStories).catch(() => {});
    }, []);

    const byId = Object.fromEntries(champions.map(c => [c.id, c]));
    const eventById = Object.fromEntries(TIMELINE.map(e => [e.id, e]));
    const regionName = slug => factions?.[slug]?.name ?? slug;

    // 지역 버튼: 누르면 넣고, 다시 누르면 뺀다.
    function toggleRegion(slug) {
        setSelected(prev => prev.includes(slug) ? prev.filter(s => s !== slug) : [...prev, slug]);
    }

    const visible = selected.length === 0
        ? TIMELINE
        : TIMELINE.filter(e => e.regions.some(r => selected.includes(r)));

    function jumpTo(id) {
        // 필터 때문에 안 보이는 사건이면 필터를 풀고 이동한다.
        if (!visible.some(e => e.id === id)) setSelected([]);
        setFlash(id);
        setTimeout(() => document.getElementById(`event-${id}`)?.scrollIntoView({behavior: 'smooth', block: 'center'}), 50);
        setTimeout(() => setFlash(null), 1800);
    }

    // 사건과 관련된 소설: 사건 챔피언이 나오고, 지역도 겹치는 소설 (최신순 3편)
    function storiesFor(e) {
        const slugs = e.champions.map(id => byId[id]?.slug).filter(Boolean);
        return stories
            .filter(s => s.champions.some(c => slugs.includes(c)) && s.regions.some(r => e.regions.includes(r)))
            .slice(0, 3);
    }

    return (
        <div className="timeline-page">
            <div className="page-intro">
                <h2>룬테라 연대기</h2>
                <p className="muted">라이엇은 정확한 연도를 거의 밝히지 않아서, 공식 설정의 시대 순서대로 정리했어요. 지역을 여러 개 고르면 서로 얽힌 사건을 따라갈 수 있어요.</p>
            </div>

            {factions && (
                <div className="chips timeline-filter">
                    <button className={selected.length === 0 ? 'chip active' : 'chip'} onClick={() => setSelected([])}>전체</button>
                    {sortRegions(factions).map(f => (
                        <button key={f.slug} className={selected.includes(f.slug) ? 'chip active' : 'chip'} onClick={() => toggleRegion(f.slug)}>
                            {f.name}
                        </button>
                    ))}
                </div>
            )}

            {visible.length === 0 && <p className="muted">고른 지역의 사건이 아직 없어요.</p>}

            <ol className="timeline">
                {ERAS.map(era => {
                    const events = visible.filter(e => e.era === era);
                    if (events.length === 0) return null;
                    return (
                        <li key={era} className="era">
                            <h3 className="era-title">{era}</h3>
                            {events.map(e => {
                                const cross = selected.length > 1 && selected.filter(s => e.regions.includes(s)).length > 1;
                                const related = storiesFor(e);
                                return (
                                    <article key={e.id} id={`event-${e.id}`} className={flash === e.id ? 'event flash' : 'event'}>
                                        <div className="event-head">
                                            <h4>{e.title}</h4>
                                            {cross && <span className="cross-badge">교차</span>}
                                        </div>
                                        <div className="chips">
                                            {e.regions.map(r => (
                                                <button key={r} className="chip" onClick={() => onOpenRegion(r)}>{regionName(r)}</button>
                                            ))}
                                        </div>
                                        <p>{e.summary}</p>

                                        <div className="event-champs">
                                            {e.champions.map(id => byId[id] && (
                                                <button key={id} onClick={() => onOpenChampion(byId[id])} title={byId[id].name}>
                                                    <img src={iconUrl(byId[id])} alt=""/>
                                                    <span>{byId[id].name}</span>
                                                </button>
                                            ))}
                                        </div>

                                        {related.length > 0 && (
                                            <div className="event-stories">
                                                <span className="muted small">관련 소설</span>
                                                {related.map(s => (
                                                    <button key={s.slug} className="story-chip" onClick={() => onOpenStory(s)}>📖 {s.title}</button>
                                                ))}
                                            </div>
                                        )}

                                        {e.links.length > 0 && (
                                            <div className="event-links">
                                                <span className="muted small">이어지는 사건</span>
                                                {e.links.map(id => (
                                                    <button key={id} className="link-btn" onClick={() => jumpTo(id)}>→ {eventById[id].title}</button>
                                                ))}
                                            </div>
                                        )}
                                    </article>
                                );
                            })}
                        </li>
                    );
                })}
            </ol>
        </div>
    );
}
