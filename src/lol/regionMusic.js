/*
    지역 배경음악 (오디오 파일을 바로 재생 → 유튜브 광고 없음)
    롤 클라이언트에 들어 있는 공식 음악 파일을 CommunityDragon 에서 그대로 쓴다.
    지역 전용 테마곡은 클라이언트에 없어서, 그 지역과 어울리는 맵·이벤트 음악을 골랐다.
    어울리는 곡이 없는 지역은 소환사의 협곡 / 클라이언트 홈 음악을 쓴다.
*/
const GAME = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default';
const MODE = `${GAME}/content/src/leagueclient/gamemodeassets`;

const RIFT = {src: `${MODE}/classic_sru/sound/music-inqueue-loop-summonersrift.ogg`, title: '소환사의 협곡'};
const HOME = {src: 'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-navigation/global/default/music-ac-home-main.ogg', title: '리그 오브 레전드 클라이언트 테마'};

export const REGION_MUSIC = {
    freljord: {src: `${MODE}/aram/sound/music-inqueue-loop-howlingabyss.ogg`, title: '칼바람 나락 (프렐요드)'},
    piltover: {src: `${GAME}/assets/events/arc2-lol-2024/mx-arc2-lol-2024-bkgrd-theme.ogg`, title: '아케인 2024 이벤트 테마'},
    zaun: {src: `${GAME}/assets/events/vik2024audio/mx-vik-bkgrd-theme.ogg`, title: '빅토르 2024 이벤트 테마'},
    'shadow-isles': {src: `${GAME}/assets/events/hol2024music/mx-hol24-bkgd-theme.ogg`, title: '2024 할로윈 이벤트 테마'},
    ionia: {src: `${MODE}/assassinate/sound/music-cs-assassinate-bloodmoon.ogg`, title: '블러드문 (아이오니아)'},
    demacia: RIFT,
    noxus: RIFT,
    shurima: RIFT,
    bilgewater: HOME,
    'mount-targon': HOME,
    ixtal: HOME,
    void: HOME,
    'bandle-city': HOME,
    unaffiliated: HOME,
};
