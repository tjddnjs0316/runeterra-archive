import { useState } from 'react';

/*
    배경음악 플레이어 (오른쪽 아래 작은 창) — 지역 페이지와 단편 소설 창에서 같이 쓴다.
    유튜브 영상을 작게 보여 주면서 재생한다. (유튜브 약관상 영상을 숨기고 소리만 틀 수는 없다)
    클릭해서 열린 화면이라 autoplay=1 이면 바로 재생된다. 소리를 꺼 두었다면 autoPlay=false 로 받아 자동 재생하지 않는다.
    loop=1 은 같은 영상 id 를 playlist 에도 넣어야 반복된다.
    화면에서 사라지면(언마운트) iframe 도 없어지면서 음악이 멈춘다.
*/
export default function MusicPlayer({music, autoPlay}) {
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
