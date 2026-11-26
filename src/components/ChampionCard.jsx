import { useEffect, useState } from 'react';
import { TAG_KO, iconUrl, loadStories, loadingUrl, passiveUrl, spellUrl, splashUrl, stripTags, toParagraphs } from '../lol/api.js';
import { StoryCard } from './Regions.jsx';
// 챔피언 사이의 관계 설명 { Garen: { Lux: { label: '여동생', desc: '...' }, ... }, ... }
// JSON 파일은 import 하면 바로 객체로 들어온다. (Vite 가 처리해 준다)
import RELATIONS from '../lol/relations.json';

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

// 지역 소개 카드: 지역 이미지를 배경으로 깔고 소개글을 보여준다. 버튼을 누르면 지역 페이지로 간다.
function RegionCard({faction, onOpenRegion}) {
    return (
        <div className="region" style={faction.image ? {backgroundImage: `url("${faction.image}")`} : undefined}>
            <div className="region-body">
                <small>소속 지역</small>
                <h4>{faction.name}</h4>
                <p>{faction.description}</p>
                <button className="btn" onClick={() => onOpenRegion(faction.slug)}>{faction.name} 이야기 보기 →</button>
            </div>
        </div>
    );
}

export default function ChampionCard({champion, summary, faction, champions, onSelect, onOpenRegion, onOpenStory, canPlay, playing, onPlayVoice}) {

    // 지금 크게 보여줄 스킨 번호 (0 = 기본 스킨)
    const [skinNum, setSkinNum] = useState(0);
    // 스토리를 끝까지 펼쳤는지
    const [expanded, setExpanded] = useState(false);
    // 이 챔피언이 나오는 단편 소설
    const [stories, setStories] = useState([]);

    useEffect(() => {
        let ignore = false;
        loadStories()
            .then(all => { if (!ignore) setStories(all.filter(s => s.champions.includes(summary.slug))); })
            .catch(() => {});
        return () => { ignore = true; };
    }, [summary.slug]);

    // skins 에는 크로마(색상 변형)도 섞여 있는데, 크로마는 parentSkin 값이 있고 이미지가 없다.
    const skins = champion.skins.filter(skin => skin.parentSkin === undefined);

    // 유니버스 스토리가 있으면 그것을, 실패했으면 Data Dragon 의 짧은 lore 를 보여준다.
    const story = champion.story;
    const paragraphs = story ? toParagraphs(story.biography.full) : [champion.lore];
    const isLong = paragraphs.join('').length > 450;

    /*
        관계 챔피언 목록
        1) 유니버스가 알려주는 관련 챔피언 (champion.related, slug 로 옴)
        2) relations.json 에 관계 설명이 있는 챔피언
        두 목록을 합치고(Set 으로 중복 제거), 유니버스 쪽을 앞에 둔다.
    */
    const relationInfo = RELATIONS[champion.id] ?? {};
    const universeIds = champion.related
        .map(r => champions.find(c => c.slug === r.slug)?.id)
        .filter(Boolean);
    const relatedIds = [...new Set([...universeIds, ...Object.keys(relationInfo)])];
    const related = relatedIds
        .map(id => ({champ: champions.find(c => c.id === id), info: relationInfo[id]}))
        .filter(r => r.champ);

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
                {/* 선택 대사 듣기: 재생 중이면 소리 막대가 움직이고, 다시 누르면 멈춘다. */}
                <button
                    className={playing ? 'voice-btn playing' : 'voice-btn'}
                    onClick={onPlayVoice}
                    disabled={!canPlay}
                    title={canPlay ? '챔피언 선택 대사 듣기' : '이 브라우저는 ogg 소리를 재생할 수 없어요'}
                >
                    <span className="voice-bars" aria-hidden="true"><i/><i/><i/><i/></span>
                    {playing ? '멈춤' : '선택 대사'}
                </button>
            </div>

            <section className="section">
                <h3 className="section-title">세계관</h3>

                {story?.biography.quote && (
                    <blockquote className="quote">
                        {stripTags(story.biography.quote)}
                        <cite>— {story.biography['quote-author'] || champion.name}</cite>
                    </blockquote>
                )}

                {faction && <RegionCard faction={faction} onOpenRegion={onOpenRegion}/>}

                <h4 className="sub-title">{champion.name}의 이야기</h4>
                <div className={isLong && !expanded ? 'lore collapsed' : 'lore'}>
                    {/* 문단은 순서가 바뀌지 않으므로 index 를 key 로 써도 괜찮다. */}
                    {paragraphs.map((p, i) => <p key={i}>{p}</p>)}
                </div>
                <div className="row-gap">
                    {isLong && (
                        <button className="btn" onClick={() => setExpanded(prev => !prev)}>
                            {expanded ? '접기' : '이야기 전체 읽기'}
                        </button>
                    )}
                    <a className="link" href={`https://universe.leagueoflegends.com/ko_KR/champion/${summary.slug}/`} target="_blank" rel="noreferrer">
                        유니버스 원문 보기 ↗
                    </a>
                </div>

                {stories.length > 0 && (
                    <>
                        <h4 className="sub-title">등장하는 단편 소설 <span className="muted small">{stories.length}편</span></h4>
                        <div className="story-grid">
                            {stories.map(s => <StoryCard key={s.slug} story={s} champions={champions} onOpen={onOpenStory}/>)}
                        </div>
                    </>
                )}

                {related.length > 0 && (
                    <>
                        <h4 className="sub-title">관계 <span className="muted small">{related.length}명</span></h4>
                        {/* 카드를 누르면 그 챔피언으로 이동한다. */}
                        <div className="relations">
                            {related.map(({champ, info}) => (
                                <button key={champ.id} className="relation" onClick={() => onSelect(champ)}>
                                    <img src={iconUrl(champ)} alt=""/>
                                    <div>
                                        <div className="relation-head">
                                            <strong>{champ.name}</strong>
                                            {info && <span className="relation-label">{info.label}</span>}
                                        </div>
                                        {info && <p>{info.desc}</p>}
                                    </div>
                                </button>
                            ))}
                        </div>
                        <p className="credit">
                            관계 설명은 라이엇 공식 설정과{' '}
                            <a className="link" href="https://namu.wiki/w/%EB%A6%AC%EA%B7%B8%20%EC%98%A4%EB%B8%8C%20%EB%A0%88%EC%A0%84%EB%93%9C/%EC%B1%94%ED%94%BC%EC%96%B8/%EA%B4%80%EA%B3%84" target="_blank" rel="noreferrer">
                                나무위키 「리그 오브 레전드/챔피언/관계」
                            </a>
                            {' '}문서를 참고해 요약했습니다. (CC BY-NC-SA 2.0 KR)
                        </p>
                    </>
                )}
            </section>

            <section className="section">
                <h3 className="section-title">지표</h3>
                {/* info 는 라이엇이 매긴 1~10 점수이다. (게임 클라이언트 챔피언 정보 화면의 막대그래프와 같은 값) */}
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
                        imgSrc={passiveUrl(champion.passive.image.full)}
                    />
                    {/* spells 는 Q, W, E, R 순서로 들어있다. */}
                    {champion.spells.map((spell, i) => (
                        <SkillRow
                            key={spell.id}
                            keyName={'QWER'[i]}
                            name={spell.name}
                            description={spell.description}
                            imgSrc={spellUrl(spell.image.full)}
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
                            <img src={loadingUrl(champion.id, skin.num)} alt={skin.name} loading="lazy"/>
                            {/* 기본 스킨은 이름이 'default' 로 온다. */}
                            <span>{skin.num === 0 ? '기본' : skin.name}</span>
                        </button>
                    ))}
                </div>
            </section>
        </article>
    );
}
