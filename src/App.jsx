import { useEffect, useState } from 'react';
import Dex from './components/Dex.jsx';
import Quiz from './components/Quiz.jsx';
import Guess from './components/Guess.jsx';
import { loadChampionList, splashUrl } from './lol/api.js';

const TABS = [
    ['dex', '도감'],
    ['guess', '추리 게임'],
    ['quiz', '퀴즈'],
];

// 모든 화면을 감싸는 틀: 배경 + 가운데 정렬 + 하단 안내문
function Frame({bg, children}) {
    return (
        <div className="lol">
            {/* key 가 바뀌면 img 를 새로 만들어서 페이드 인 애니메이션이 다시 실행된다. */}
            <div className="lol-bg">{bg && <img key={bg} src={bg} alt=""/>}</div>
            <div className="lol-inner">
                {children}
                {/* 라이엇 팬 콘텐츠 정책(Legal Jibber Jabber)에서 요구하는 안내문. 배포할 때 꼭 남겨 둔다. */}
                <footer className="lol-footer">
                    룬테라 아카이브는 Riot Games의 보증을 받지 않았으며, Riot Games 또는 Riot Games 자산의 제작·관리에 공식적으로 관여하는
                    사람들의 견해나 의견을 반영하지 않습니다. Riot Games 및 관련 자산은 Riot Games, Inc.의 상표 또는 등록 상표입니다.
                </footer>
            </div>
        </div>
    );
}

export default function App() {
    const [champions, setChampions] = useState([]);   // 전체 목록 (한글 가나다순)
    const [factions, setFactions] = useState(null);   // 지역 정보 (유니버스 실패 시 null)
    const [index, setIndex] = useState(0);            // 도감에서 보고 있는 챔피언 순서
    const [tab, setTab] = useState('dex');
    const [loadError, setLoadError] = useState(false);

    // 목록은 처음 한 번만 요청한다.
    useEffect(() => {
        loadChampionList()
            .then(({champions, factions}) => {
                setChampions(champions);
                setFactions(factions);
            })
            .catch(() => setLoadError(true));
    }, []);

    // 퀴즈·추리 게임의 "도감에서 보기": 도감 탭으로 바꾸고 그 챔피언을 고른다.
    function openInDex(c) {
        setTab('dex');
        setIndex(champions.indexOf(c));
        window.scrollTo({top: 0, behavior: 'smooth'});
    }

    if (loadError) {
        return <Frame><div className="center-msg">챔피언 목록을 불러오지 못했어요. 인터넷 연결을 확인하고 새로고침해 주세요.</div></Frame>;
    }
    if (champions.length === 0) {
        return <Frame><div className="center-msg"><div className="spinner"/>챔피언 목록 불러오는 중...</div></Frame>;
    }

    return (
        <Frame bg={tab === 'dex' ? splashUrl(champions[index].id) : null}>
            <header className="lol-header">
                <div className="lol-logo">
                    <small>RUNETERRA ARCHIVE</small>
                    <h1>룬테라 아카이브</h1>
                </div>
                <nav className="tabs">
                    {TABS.map(([value, label]) => (
                        <button key={value} className={tab === value ? 'tab active' : 'tab'} onClick={() => setTab(value)}>
                            {label}
                        </button>
                    ))}
                </nav>
            </header>

            {/*
                탭은 조건부 렌더링({tab === 'quiz' && <Quiz/>}) 대신 hidden 으로 숨긴다.
                조건부 렌더링은 화면에서 빠질 때 컴포넌트를 없애서 state(점수, 검색어, 진행 상황)가 사라지지만,
                hidden 은 보이지만 않을 뿐 컴포넌트가 살아 있어서 다른 탭에 다녀와도 그대로 남는다.
            */}
            <div hidden={tab !== 'dex'}>
                <Dex champions={champions} factions={factions} index={index} setIndex={setIndex}/>
            </div>
            <div hidden={tab !== 'guess'}>
                <Guess champions={champions} factions={factions} onOpen={openInDex}/>
            </div>
            <div hidden={tab !== 'quiz'}>
                <Quiz champions={champions} factions={factions} onOpen={openInDex}/>
            </div>
        </Frame>
    );
}
