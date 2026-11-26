import { useEffect, useRef, useState } from 'react';

const VOLUME_STORE = 'lol-music-volume';

// 이 브라우저가 ogg 소리를 재생할 수 있는지 (못 하면 플레이어를 띄우지 않는다)
const CAN_PLAY_OGG = typeof Audio !== 'undefined' && new Audio().canPlayType('audio/ogg; codecs="vorbis"') !== '';

function readVolume() {
    try {
        const v = Number(localStorage.getItem(VOLUME_STORE));
        return localStorage.getItem(VOLUME_STORE) !== null && v >= 0 && v <= 1 ? v : 0.5;
    } catch {
        return 0.5;
    }
}

/*
    배경음악 플레이어 (오른쪽 아래 작은 창) — 지역 페이지와 단편 소설 창에서 같이 쓴다.
    <audio> 로 음악 파일을 바로 재생한다. (유튜브가 아니라 광고가 없다)
    - autoPlay: 클릭해서 열린 화면이라 바로 재생해도 브라우저가 막지 않는다. 소리를 꺼 두었다면 false 로 받는다.
    - loop: 곡이 끝나면 처음부터 다시
    - 화면에서 사라지면(언마운트) <audio> 도 없어지면서 음악이 멈춘다.
*/
export default function MusicPlayer({music, autoPlay}) {
    const audioRef = useRef(null);
    const [playing, setPlaying] = useState(false);
    const [open, setOpen] = useState(true);
    const [volume, setVolume] = useState(readVolume);

    // 곡이 바뀌거나 처음 뜰 때 자동 재생 (막히면 그냥 ▶ 버튼을 누르면 된다)
    useEffect(() => {
        if (autoPlay) audioRef.current?.play().catch(() => {});
    }, [music.src, autoPlay]);

    // 음량을 <audio> 에 적용하고 저장해 둔다.
    useEffect(() => {
        if (audioRef.current) audioRef.current.volume = volume;
        try {
            localStorage.setItem(VOLUME_STORE, String(volume));
        } catch {
            // 저장 실패는 무시
        }
    }, [volume]);

    if (!CAN_PLAY_OGG) return null;

    function toggle() {
        const audio = audioRef.current;
        if (audio.paused) audio.play().catch(() => {});
        else audio.pause();
    }

    // 닫으면 멈추고 작은 버튼만 남긴다. 버튼을 누르면 다시 열리면서 재생된다.
    function close() {
        audioRef.current.pause();
        setOpen(false);
    }
    function reopen() {
        setOpen(true);
        audioRef.current.play().catch(() => {});
    }

    return (
        <>
            <audio
                ref={audioRef}
                src={music.src}
                loop
                preload="auto"
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onLoadedMetadata={e => { e.currentTarget.volume = volume; }}
            />
            {open ? (
                <div className="music-player">
                    <button className={playing ? 'music-play playing' : 'music-play'} onClick={toggle} aria-label={playing ? '일시정지' : '재생'}>
                        {playing ? '❚❚' : '▶'}
                    </button>
                    <div className="music-info">
                        <small>배경음악</small>
                        <span>{music.title}</span>
                    </div>
                    <input
                        className="music-volume"
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={volume}
                        onChange={e => setVolume(Number(e.target.value))}
                        aria-label="음량"
                    />
                    <button className="music-close" onClick={close} aria-label="배경음악 끄기">✕</button>
                </div>
            ) : (
                <button className="music-reopen" onClick={reopen}>♪ 배경음악</button>
            )}
        </>
    );
}
