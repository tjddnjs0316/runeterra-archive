import { useEffect, useState } from 'react';
import { loadStory } from '../lol/api.js';

/*
    단편 소설 읽기 창 (화면 위에 겹쳐 뜨는 창)
    story : stories.json 의 소설 한 편 { slug, title, image, minutes, ... }
    본문은 열 때 유니버스에서 받아 온다.
*/
export default function StoryReader({story, onClose}) {
    const [data, setData] = useState(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        let ignore = false;
        loadStory(story.slug)
            .then(d => { if (!ignore) setData(d); })
            .catch(() => { if (!ignore) setFailed(true); });
        return () => { ignore = true; };
    }, [story.slug]);

    // 창이 열려 있는 동안: Esc 로 닫기 + 뒤 페이지 스크롤 막기
    useEffect(() => {
        const onKey = e => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            window.removeEventListener('keydown', onKey);
            document.body.style.overflow = prevOverflow;
        };
    }, [onClose]);

    return (
        // 바깥 어두운 부분을 누르면 닫히고, 안쪽(article)을 누를 때는 닫히지 않게 stopPropagation
        <div className="reader-backdrop" onClick={onClose}>
            <article className="reader" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={story.title}>
                <button className="reader-close" onClick={onClose} aria-label="닫기">✕</button>
                <div className="reader-hero" style={{backgroundImage: `url("${story.image}")`}}>
                    <div>
                        <p className="eyebrow">단편 소설 · {story.minutes}분</p>
                        <h2>{story.title}</h2>
                    </div>
                </div>

                <div className="reader-body">
                    {failed && <p className="muted">이야기를 불러오지 못했어요.</p>}
                    {!data && !failed && <div className="center-msg"><div className="spinner"/>이야기를 불러오는 중...</div>}
                    {data?.sections.map((sec, i) => (
                        <section key={i}>
                            {sec.title && <h3>{sec.title}</h3>}
                            {sec.paragraphs.map((p, j) => (
                                p === '***'
                                    ? <hr key={j} className="scene-break"/>
                                    : <p key={j}>{p}</p>
                            ))}
                        </section>
                    ))}
                    {data && (
                        <a className="link" href={`https://universe.leagueoflegends.com/ko_KR/story/${story.slug}/`} target="_blank" rel="noreferrer">
                            유니버스에서 원문 보기 ↗
                        </a>
                    )}
                </div>
            </article>
        </div>
    );
}
