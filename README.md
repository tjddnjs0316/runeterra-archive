# 룬테라 아카이브

리그 오브 레전드 챔피언 도감 + 챔피언 추리 게임 + 퀴즈 (React + Vite)

## 실행

```bash
npm install     # 처음 한 번
npm run dev     # 개발 서버 → http://localhost:5173
npm run build   # 배포용 파일을 dist/ 에 만든다
npm run preview # 만든 dist/ 를 미리 보기
```

## 구조

```
src/
  main.jsx               시작점
  App.jsx                탭(도감 / 추리 게임 / 퀴즈), 목록 요청
  styles.css             전체 스타일
  lol/api.js             Data Dragon·유니버스 요청, 공통 도구
  components/
    Dex.jsx              도감 (검색·필터·목록)
    ChampionCard.jsx     챔피언 상세 카드 (세계관·스킬·스킨)
    Guess.jsx            챔피언 추리 게임 (오늘의 챔피언 / 무한 모드)
    Quiz.jsx             4지선다 퀴즈
08_lol.jsx               수업용 원본 (한 파일 버전, 앱에서는 쓰지 않음)
```

## 데이터

- Data Dragon (라이엇 공식 정적 데이터, 키 필요 없음). 버전은 시작할 때 `versions.json` 에서 최신으로 받아 온다.
- 리그 오브 레전드 유니버스 사이트 데이터 (소속 지역, 스토리). 공식 문서가 없는 주소라 실패해도 도감은 동작한다.

## 배포

GitHub Pages 로 배포한다. 내 컴퓨터에서 빌드한 `dist/` 를 `gh-pages` 브랜치에 올린다.

```bash
npm run deploy   # 빌드 + gh-pages 브랜치로 업로드 (1~2분 뒤 사이트에 반영)
```

코드 저장(main 브랜치)은 따로 `git add` / `git commit` / `git push` 한다.

- 화면 아래의 라이엇 안내문(팬 콘텐츠 정책)은 지우지 않는다.
- 관계 설명은 나무위키(CC BY-NC-SA 2.0 KR)를 참고했으므로 출처 표시를 유지하고, 광고 등 영리 목적으로 쓰지 않는다.
