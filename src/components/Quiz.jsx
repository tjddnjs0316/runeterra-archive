import { useEffect, useState } from 'react';
import { TAG_KO, iconUrl, loadChampionData, shuffle, splashUrl, spellUrl } from '../lol/api.js';

/*
    챔피언 퀴즈
    무작위로 챔피언 4명을 뽑아 보기로 만들고, 그중 한 명을 정답으로 정한다.
    문제 종류
      splash : 스플래시 아트를 크게 확대해서 일부만 보여준다. 정답을 고르면 원래 크기로 줄어든다.
      title  : 칭호만 보여준다. ('데마시아의 힘' → 가렌)
      skill  : 스킬 아이콘만 보여준다. 스킬 정보는 목록에 없어서 이 문제일 때만 상세를 요청한다.
*/
const QUIZ_TYPES = ['splash', 'title', 'skill'];
const QUIZ_LABEL = {splash: '스플래시 아트', title: '칭호', skill: '스킬 아이콘'};

export default function Quiz({champions, factions, onOpen}) {
    const [question, setQuestion] = useState(null);   // 현재 문제
    const [picked, setPicked] = useState(null);       // 고른 챔피언 id (null = 아직 안 고름)
    const [showHint, setShowHint] = useState(false);
    const [loading, setLoading] = useState(false);
    const [score, setScore] = useState(0);            // 맞힌 개수
    const [total, setTotal] = useState(0);            // 푼 개수
    const [streak, setStreak] = useState(0);          // 연속 정답
    const [best, setBest] = useState(0);              // 최고 연속 정답

    async function nextQuestion() {
        setLoading(true);
        const choices = shuffle(champions).slice(0, 4);               // 보기 4개
        const answer = choices[Math.floor(Math.random() * 4)];        // 그중 하나가 정답
        let type = QUIZ_TYPES[Math.floor(Math.random() * QUIZ_TYPES.length)];

        let spell = null;
        if (type === 'skill') {
            try {
                const data = await loadChampionData(answer.id);
                const i = Math.floor(Math.random() * 4);   // Q, W, E, R 중 하나
                const s = data.spells[i];
                spell = {key: 'QWER'[i], name: s.name, img: spellUrl(s.image.full)};
            } catch {
                type = 'title';   // 요청이 실패하면 칭호 문제로 바꾼다.
            }
        }

        setQuestion({
            id: Date.now(),   // 문제마다 다른 값. key 로 써서 새 문제마다 화면을 새로 만든다.
            answer, choices, type, spell,
            // 확대할 위치(%). 얼굴이 있는 위쪽 가운데 근처가 나오도록 범위를 좁혔다.
            x: 25 + Math.random() * 50,
            y: 15 + Math.random() * 40,
        });
        setPicked(null);
        setShowHint(false);
        setLoading(false);
    }

    // 처음 한 번 문제를 만든다.
    useEffect(() => {
        nextQuestion();
    }, []);

    function pick(c) {
        if (picked) return;
        const correct = c.id === question.answer.id;
        const nextStreak = correct ? streak + 1 : 0;
        setPicked(c.id);
        setTotal(prev => prev + 1);
        if (correct) setScore(prev => prev + 1);
        setStreak(nextStreak);
        setBest(prev => Math.max(prev, nextStreak));
    }

    // 건너뛰면 연속 정답이 끊긴다.
    function skip() {
        setStreak(0);
        nextQuestion();
    }

    if (!question) return <div className="center-msg"><div className="spinner"/>문제를 만드는 중...</div>;

    const {answer, type, spell} = question;
    const revealed = picked !== null;
    const isCorrect = picked === answer.id;
    const regionName = factions?.[answer.faction]?.name ?? '알 수 없음';

    const prompt = {
        splash: '확대된 그림 속 챔피언은 누구일까요?',
        title: '이 칭호를 가진 챔피언은?',
        skill: `이 스킬(${spell?.key})의 주인은?`,
    }[type];

    return (
        <div className="quiz">
            <div className="game-top">
                <div>
                    <h2>챔피언 맞히기</h2>
                    <p className="muted">그림 일부, 칭호, 스킬 아이콘을 보고 챔피언을 골라 보세요.</p>
                </div>
                <div className="score">
                    <div><small>정답</small><b>{score}/{total}</b></div>
                    <div><small>연속</small><b>{streak}</b></div>
                    <div><small>최고 연속</small><b>{best}</b></div>
                </div>
            </div>

            <div className="panel quiz-card" key={question.id}>
                <p className="quiz-q">{QUIZ_LABEL[type]}</p>
                <p className="quiz-prompt">{prompt}</p>

                {type === 'splash' && (
                    <div className="zoom">
                        <img
                            src={splashUrl(answer.id)}
                            alt="확대된 스플래시 아트"
                            style={{
                                transformOrigin: `${question.x}% ${question.y}%`,
                                transform: revealed ? 'scale(1)' : 'scale(3.2)',
                            }}
                        />
                    </div>
                )}
                {type === 'title' && <div className="big-title">“{answer.title}”</div>}
                {type === 'skill' && (
                    <div className="big-skill">
                        <img src={spell.img} alt="스킬 아이콘"/>
                        <span className="muted">[{spell.key}] {revealed ? spell.name : '???'}</span>
                    </div>
                )}

                {showHint && !revealed && (
                    <div className="hint">힌트 · {regionName} 소속 · {answer.tags.map(t => TAG_KO[t] ?? t).join(', ')}</div>
                )}

                <div className="choices">
                    {question.choices.map(c => {
                        // 고른 뒤에는 정답은 초록, 내가 고른 오답은 빨강, 나머지는 흐리게
                        let className = 'choice';
                        if (revealed) {
                            if (c.id === answer.id) className += ' correct';
                            else if (c.id === picked) className += ' wrong';
                            else className += ' dim';
                        }
                        return (
                            <button key={c.id} className={className} disabled={revealed} onClick={() => pick(c)}>
                                {c.name}
                                <small>{c.enName}</small>
                            </button>
                        );
                    })}
                </div>

                {revealed && (
                    <div className={isCorrect ? 'result ok' : 'result no'}>
                        <img src={iconUrl(answer)} alt={answer.name}/>
                        <div>
                            <h4>{isCorrect ? '정답이에요!' : `아쉬워요! 정답은 ${answer.name}`}</h4>
                            <p>{answer.title} · {regionName}</p>
                        </div>
                    </div>
                )}

                <div className="quiz-actions">
                    {!revealed && <button className="btn" onClick={() => setShowHint(true)} disabled={showHint}>힌트 보기</button>}
                    {revealed && <button className="btn" onClick={() => onOpen(answer)}>도감에서 보기</button>}
                    <button className="btn btn-primary" onClick={revealed ? nextQuestion : skip} disabled={loading}>
                        {revealed ? '다음 문제' : '건너뛰기'}
                    </button>
                </div>
            </div>
        </div>
    );
}
