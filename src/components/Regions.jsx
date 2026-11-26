import { useEffect, useState } from 'react';
import { iconUrl, loadFaction, loadStories } from '../lol/api.js';
import { REGION_MUSIC } from '../lol/regionMusic.js';

/*
    지역 배경음악 플레이어 (오른쪽 아래 작은 창)
    유튜브 영상을 작게 보여 주면서 재생한다. (유튜브 약관상 영상을 숨기고 소리만 틀 수는 없다)
    지역을 클릭해서 들어왔기 때문에 autoplay=1 로 바로 재생된다. 대사 소리를 꺼 두었다면 자동 재생하지 않는다.
    loop=1 은 같은 영상 id 를 playlist 에도 넣어야 반복된다.
*/
function MusicPlayer({music, autoPlay}) {
    const [open, setOpen] = useState(true);
    if (!open) {
        return <button className="music-reopen" onClick={() => setOpen(true)}>♪ 배경음악</button>;
    }
    const params = `autoplay=${autoPlay ? 1 : 0}&loop=1&playlist=${music.youtube}&rel=0`;
    return (
        <div className="music-player">
            <div className="music-head">
                <span>♪ {music.title}</span>
                <button onClick={() => setOpen(false)} aria-label="배경음악 닫기">✕</button>
            </div>
            <iframe
                src={`https://www.youtube-nocookie.com/embed/${music.youtube}?${params}`}
                title={`배경음악: ${music.title}`}
                allow="autoplay; encrypted-media"
            />
        </div>
    );
}

// 지역 순서: 가나다순, '무소속'은 맨 뒤
export function sortRegions(factions) {
    return Object.values(factions).sort((a, b) => {
        if (a.slug === 'unaffiliated') return 1;
        if (b.slug === 'unaffiliated') return -1;
        return a.name.localeCompare(b.name, 'ko');
    });
}

// 소설 카드 (지역 페이지와 챔피언 카드에서 같이 쓴다)
export function StoryCard({story, champions, onOpen}) {
    const featured = story.champions
        .map(slug => champions.find(c => c.slug === slug))
        .filter(Boolean);
    return (
        <button className="story-card" onClick={() => onOpen(story)}>
            <div className="story-img" style={{backgroundImage: `url("${story.image}")`}}/>
            <div className="story-text">
                <strong>{story.title}</strong>
                <p>{story.description}</p>
                <div className="story-meta">
                    <span className="story-champs">
                        {featured.slice(0, 4).map(c => <img key={c.id} src={iconUrl(c)} alt={c.name} title={c.name}/>)}
                    </span>
                    <span className="muted small">{story.minutes}분 · {story.date.slice(0, 4)}</span>
                </div>
            </div>
        </button>
    );
}

// 지역 목록: 지역 그림 카드
function RegionList({factions, champions, stories, onSelect}) {
    return (
        <div className="region-grid">
            {sortRegions(factions).map(f => (
                <button
                    key={f.slug}
                    className="region-tile"
                    onClick={() => onSelect(f.slug)}
                    style={f.image ? {backgroundImage: `url("${f.image}")`} : undefined}
                >
                    <div className="region-tile-body">
                        <h3>{f.name}</h3>
                        <p>{f.description}</p>
                        <span className="muted small">
                            챔피언 {champions.filter(c => c.faction === f.slug).length}명
                            {stories && ` · 이야기 ${stories.filter(s => s.regions.includes(f.slug)).length}편`}
                        </span>
                    </div>
                </button>
            ))}
        </div>
    );
}

// 지역 페이지
function RegionPage({faction, champions, stories, onBack, onOpenChampion, onOpenStory, soundOn}) {
    const [detail, setDetail] = useState(null);   // 유니버스 지역 상세 (무소속은 없음)
    const [showAll, setShowAll] = useState(false);
    const [photo, setPhoto] = useState(null);     // 크게 보는 풍경 사진

    useEffect(() => {
        if (faction.slug === 'unaffiliated') return;
        let ignore = false;
        loadFaction(faction.slug)
            .then(d => { if (!ignore) setDetail(d); })
            .catch(() => { if (!ignore) setDetail({failed: true}); });
        return () => { ignore = true; };
    }, [faction.slug]);

    const members = champions.filter(c => c.faction === faction.slug);
    const regionStories = (stories ?? []).filter(s => s.regions.includes(faction.slug));
    const shownStories = showAll ? regionStories : regionStories.slice(0, 6);
    const overview = detail?.overview?.length ? detail.overview : [faction.description];
    const mainVideo = detail?.videos?.[0];

    return (
        <article className="card region-page">
            <div className="region-hero" style={faction.image ? {backgroundImage: `url("${faction.image}")`} : undefined}>
                {/* 지역 대표 영상(webm)이 있으면 소리 없이 반복 재생한다. 영상이 안 되면 뒤의 배경 그림이 보인다. */}
                {detail?.video && <video src={detail.video} autoPlay muted loop playsInline/>}
                <div className="hero-shade"/>
                <button className="btn back-btn" onClick={onBack}>← 모든 지역</button>
                <div className="hero-text">
                    <p className="eyebrow">REGION</p>
                    <h2>{faction.name}</h2>
                    <p className="hero-title">챔피언 {members.length}명 · 이야기 {regionStories.length}편</p>
                </div>
            </div>

            <section className="section">
                <h3 className="section-title">지역 소개</h3>
                <div className="lore">{overview.map((p, i) => <p key={i}>{p}</p>)}</div>
                {faction.slug !== 'unaffiliated' && (
                    <a className="link" href={`https://universe.leagueoflegends.com/ko_KR/region/${faction.slug}/`} target="_blank" rel="noreferrer">
                        유니버스에서 {faction.name} 보기 ↗
                    </a>
                )}
            </section>

            {mainVideo && (
                <section className="section">
                    <h3 className="section-title">영상</h3>
                    {/* youtube-nocookie: 재생 전에는 쿠키를 남기지 않는 유튜브 주소 */}
                    <div className="video-frame">
                        <iframe
                            src={`https://www.youtube-nocookie.com/embed/${mainVideo.youtube}`}
                            title={mainVideo.title}
                            loading="lazy"
                            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                        />
                    </div>
                    <p className="video-caption"><strong>{mainVideo.title}</strong> {mainVideo.description}</p>
                    {detail.videos.slice(1).map(v => (
                        <a key={v.youtube} className="link block-link" href={`https://www.youtube.com/watch?v=${v.youtube}`} target="_blank" rel="noreferrer">
                            ▶ {v.title} ↗
                        </a>
                    ))}
                </section>
            )}

            <section className="section">
                <h3 className="section-title">이야기 {regionStories.length}</h3>
                {!stories && <p className="muted">이야기 목록을 불러오는 중...</p>}
                {stories && regionStories.length === 0 && <p className="muted">아직 이 지역의 이야기가 없어요.</p>}
                <div className="story-grid">
                    {shownStories.map(s => <StoryCard key={s.slug} story={s} champions={champions} onOpen={onOpenStory}/>)}
                </div>
                {regionStories.length > 6 && (
                    <button className="btn more-btn" onClick={() => setShowAll(prev => !prev)}>
                        {showAll ? '접기' : `이야기 ${regionStories.length - 6}편 더 보기`}
                    </button>
                )}
            </section>

            <section className="section">
                <h3 className="section-title">{faction.name}의 챔피언</h3>
                <div className="member-grid">
                    {members.map(c => (
                        <button key={c.id} className="champ" onClick={() => onOpenChampion(c)} title={c.title}>
                            <img src={iconUrl(c)} alt={c.name} loading="lazy"/>
                            <span>{c.name}</span>
                        </button>
                    ))}
                </div>
            </section>

            {detail?.galleries?.map(g => (
                <section className="section" key={g.title}>
                    <h3 className="section-title">{g.title}</h3>
                    <div className="gallery">
                        {g.images.map(img => (
                            <button key={img.src} className="gallery-item" onClick={() => setPhoto(img)}>
                                <img src={img.src} alt={img.caption} loading="lazy"/>
                                {img.caption && <span>{img.caption}</span>}
                            </button>
                        ))}
                    </div>
                </section>
            ))}

            {detail?.comics?.length > 0 && (
                <section className="section">
                    <h3 className="section-title">만화</h3>
                    {detail.comics.map(c => (
                        <a key={c.url} className="comic-link" href={c.url} target="_blank" rel="noreferrer">
                            <strong>{c.title} ↗</strong>
                            <span className="muted small">{c.description.slice(0, 90)}{c.description.length > 90 ? '…' : ''}</span>
                        </a>
                    ))}
                </section>
            )}

            {detail?.failed && <p className="section muted">지역 상세 정보를 불러오지 못했어요.</p>}

            {/* 배경음악이 있는 지역만. 지역 페이지를 나가면 컴포넌트가 사라지면서 음악도 멈춘다. */}
            {REGION_MUSIC[faction.slug] && <MusicPlayer music={REGION_MUSIC[faction.slug]} autoPlay={soundOn}/>}

            {/* 풍경 사진 크게 보기: 아무 데나 누르면 닫힌다. */}
            {photo && (
                <div className="reader-backdrop" onClick={() => setPhoto(null)}>
                    <figure className="photo-view">
                        <img src={photo.src} alt={photo.caption}/>
                        {photo.caption && <figcaption>{photo.caption}</figcaption>}
                    </figure>
                </div>
            )}
        </article>
    );
}

/*
    지역 화면
    regionSlug 가 없으면 지역 목록, 있으면 그 지역 페이지를 보여준다. (App 이 regionSlug 를 가지고 있다)
*/
export default function Regions({factions, champions, regionSlug, setRegionSlug, onOpenChampion, onOpenStory, soundOn}) {
    const [stories, setStories] = useState(null);

    useEffect(() => {
        loadStories().then(setStories).catch(() => setStories([]));
    }, []);

    if (!factions) return <div className="panel center-msg">지역 정보를 불러오지 못했어요.</div>;

    const faction = regionSlug ? factions[regionSlug] : null;
    if (!faction) {
        return (
            <>
                <div className="page-intro">
                    <h2>룬테라의 지역</h2>
                    <p className="muted">지역을 고르면 소개, 영상, 그 지역 챔피언들의 단편 소설을 볼 수 있어요.</p>
                </div>
                <RegionList factions={factions} champions={champions} stories={stories} onSelect={setRegionSlug}/>
            </>
        );
    }
    return (
        <RegionPage
            key={faction.slug}
            faction={faction}
            champions={champions}
            stories={stories}
            onBack={() => setRegionSlug(null)}
            onOpenChampion={onOpenChampion}
            onOpenStory={onOpenStory}
            soundOn={soundOn}
        />
    );
}
