import { useEffect, useState } from 'react';
import Dex from './components/Dex.jsx';
import { loadChampionList, splashUrl } from './lol/api.js';

const SOUND_STORE = 'lol-sound-on';

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
                    <br/>챔피언 음성은 CommunityDragon 이 공개한 게임 파일을 사용합니다.
                </footer>
            </div>
        </div>
    );
}

// localStorage 는 막혀 있을 수 있어서 try/catch 로 감싼다.
function readSound() {
    try {
        return localStorage.getItem(SOUND_STORE) !== 'off';
    } catch {
        return true;
    }
}

export default function App() {
    const [champions, setChampions] = useState([]);   // 전체 목록 (한글 가나다순)
    const [factions, setFactions] = useState(null);   // 지역 정보 (유니버스 실패 시 null)
    const [index, setIndex] = useState(0);            // 보고 있는 챔피언 순서
    const [soundOn, setSoundOn] = useState(readSound); // 챔피언을 고를 때 대사 자동 재생
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

    // 소리 설정이 바뀌면 저장해 둔다. (다음에 와도 그대로)
    useEffect(() => {
        try {
            localStorage.setItem(SOUND_STORE, soundOn ? 'on' : 'off');
        } catch {
            // 저장 실패는 무시
        }
    }, [soundOn]);

    if (loadError) {
        return <Frame><div className="center-msg">챔피언 목록을 불러오지 못했어요. 인터넷 연결을 확인하고 새로고침해 주세요.</div></Frame>;
    }
    if (champions.length === 0) {
        return <Frame><div className="center-msg"><div className="spinner"/>챔피언 목록 불러오는 중...</div></Frame>;
    }

    return (
        <Frame bg={splashUrl(champions[index].id)}>
            <header className="lol-header">
                <div className="lol-logo">
                    <small>RUNETERRA ARCHIVE</small>
                    <h1>룬테라 아카이브</h1>
                </div>
                <button
                    className={soundOn ? 'sound-toggle on' : 'sound-toggle'}
                    onClick={() => setSoundOn(prev => !prev)}
                    aria-pressed={soundOn}
                >
                    {soundOn ? '🔊 선택 대사 켜짐' : '🔇 선택 대사 꺼짐'}
                </button>
            </header>

            <Dex champions={champions} factions={factions} index={index} setIndex={setIndex} soundOn={soundOn}/>
        </Frame>
    );
}
