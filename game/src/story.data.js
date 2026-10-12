// Add chapter scripts here; story.js renders the same UI for both game versions.
export const STORY_CHARACTERS = {
  '민지': { face: 'minji', file: './assets/story/minji.png' },
  '호야': { face: 'hoya', file: './assets/story/hoya.png' },
  '수달이': { face: 'otter', file: './assets/story/otter.png' },
  '개굴이': { face: 'frog', file: './assets/story/frog.png' },
  '구정물 대왕': { face: 'boss-angry', file: './assets/story/boss-angry.png' },
  '맑아진 대왕': { face: 'boss-calm', file: './assets/story/boss-calm.png' },
  '참새': { face: 'sparrow', file: './assets/story/sparrow.png' },
  '경비 아저씨': { face: 'guard', file: './assets/story/guard.png' },
  '쓰레기 산 대왕': { face: 'boss1-angry', file: './assets/story/boss1-angry.png' },
  '깨끗해진 대왕': { face: 'boss1-calm', file: './assets/story/boss1-calm.png' },
  '야옹이': { face: 'cat', file: './assets/story/cat.png' },
  '까마귀': { face: 'crow', file: './assets/story/crow.png' },
  '굴뚝 가스 대왕': { face: 'boss2-angry', file: './assets/story/boss2-angry.png' },
  '차분해진 굴뚝 대왕': { face: 'boss2-calm', file: './assets/story/boss2-calm.png' },
};
export const STORY_FACES = Object.fromEntries(Object.values(STORY_CHARACTERS).map(c => [c.face, c.file]));
// docs/44_학생_활동지_반영_준비.md, section 1: approved polished draft, verbatim.
export const STORY_SCENES = [
  // docs/49_스토리_1-2장_다듬은_대본.md: student drafts for chapters 1-2, polished, verbatim.
  {
    id: 'ch1-start', trigger: { stage: 'CH01', when: 'before-start' }, title: '서호 수호대 출동!',
    lines: [
      { who: '민지', face: 'minji', stage: '코를 찡그리며', text: '또 쓰레기야! 못 참겠어. 그래서 수호대를 만든 거야!' },
      { who: '호야', face: 'hoya', text: '이 골목을 지나면 쓰레기 산 대왕을 만난대.' },
      { who: '참새', face: 'sparrow', stage: '전깃줄 위에서', text: '짹… 안 될 거 같애. 무서워.' },
      { who: '호야', face: 'hoya', text: '괜찮아. 가자! 서호 수호대!' },
      { who: '경비 아저씨', face: 'guard', stage: '빗자루를 들고', text: '가자! 나도 응원하마.' },
    ],
  },
  {
    id: 'ch1-boss', trigger: { stage: 'CH05', when: 'before-start' }, title: '쓰레기 산 대왕 등장',
    lines: [
      { who: '호야', face: 'hoya', text: '여기가 쓰레기 산 대왕이 있는 곳이구나.' },
      { who: '민지', face: 'minji', stage: '깜짝 놀라며', text: '헉, 쓰레기가 산처럼 쌓였어!' },
      { who: '쓰레기 산 대왕', face: 'boss1-angry', text: '너희가 수호대냐? 사람들이 자꾸 버려서 내가 이렇게 커졌어!' },
      { who: '호야', face: 'hoya', text: '우리가 쓰레기를 다 주우면 너도 가벼워질 거야.' },
      { who: '쓰레기 산 대왕', face: 'boss1-angry', text: '그래? 그럼 어디 한번 해 봐라!' },
    ],
  },
  {
    id: 'ch1-clear', trigger: { stage: 'CH05', when: 'after-clear' }, title: '쓰레기 산 대왕, 깨끗해지다',
    lines: [
      { who: '깨끗해진 대왕', face: 'boss1-calm', text: '이제 새들이 나에게 와 줄 거야. 고마워.' },
      { who: '참새', face: 'sparrow', stage: '어깨에 앉으며', text: '짹! 나도 놀러 갈게.' },
      { who: '경비 아저씨', face: 'guard', text: '마을 사람들도 약속했단다. 쓰레기는 쓰레기통에!' },
      { who: '민지', face: 'minji', text: '우리 더 많은 곳을 청소해 보자.' },
      { who: '호야', face: 'hoya', text: '가자! 서호 수호대!' },
    ],
  },
  {
    id: 'ch2-start', trigger: { stage: 'CH06', when: 'before-start' }, title: '공장 지대에 도착했어요',
    lines: [
      { who: '민지', face: 'minji', text: '여기가 그 공장인가?' },
      { who: '호야', face: 'hoya', text: '맞는 것 같아. 쿰쿰한 냄새가 나는 걸 보니.' },
      { who: '야옹이', face: 'cat', text: '공장 안으로 들어가 보면 어떻게 될까?' },
      { who: '까마귀', face: 'crow', stage: '연기를 쪼아 보며', text: '켁, 이건 못 먹겠다! 안에 굴뚝 가스 대왕이 있을 거야.' },
      { who: '호야', face: 'hoya', text: '들어가자! 서호 수호대!' },
    ],
  },
  {
    id: 'ch2-boss', trigger: { stage: 'CH10', when: 'before-start' }, title: '굴뚝 가스 대왕 등장',
    lines: [
      { who: '까마귀', face: 'crow', text: '저기 봐! 굴뚝 가스 대왕이야!' },
      { who: '굴뚝 가스 대왕', face: 'boss2-angry', text: '다! 전부 다! 너네 때문이야!' },
      { who: '민지', face: 'minji', text: '진정해! 새는 밸브는 우리가 잠가 줄게.' },
      { who: '야옹이', face: 'cat', text: '굴뚝 가스 대왕을 막아야 해!' },
      { who: '호야', face: 'hoya', text: '가자! 서호 수호대!' },
    ],
  },
  {
    id: 'ch2-clear', trigger: { stage: 'CH10', when: 'after-clear' }, title: '깨끗해진 공장',
    lines: [
      { who: '호야', face: 'hoya', text: '굴뚝 가스 대왕이 진정했어!' },
      { who: '까마귀', face: 'crow', text: '하늘도 다시 맑아졌어. 까악!' },
      { who: '민지', face: 'minji', text: '다행이야. 가까운 곳은 걸어 다니면 공기가 맑아진대.' },
      { who: '차분해진 굴뚝 대왕', face: 'boss2-calm', text: '하천에도 대왕이 한 마리 있어.' },
      { who: '호야', face: 'hoya', text: '하천으로 가자! 서호 수호대!' },
    ],
  },
  // docs/44_학생_활동지_반영_준비.md, section 1 (chapter 3).
  {
    id: 'ch3-start', trigger: { stage: 'CH11', when: 'before-start' }, title: '개울을 구하라!',
    lines: [
      { who: '민지', face: 'minji', stage: '코를 막으며', text: '개울에 거품이 둥둥 떠 있어.' },
      { who: '수달이', face: 'otter', stage: '시무룩', text: '끼잉… 여긴 우리 집이었는데.' },
      { who: '개굴이', face: 'frog', stage: '바위 뒤에서', text: '개굴… 우린 안 될 것 같은데.' },
      { who: '호야', face: 'hoya', text: '괜찮아. 우리가 같이 갈게!' },
      { who: '민지', face: 'minji', text: '좋아, 도전해 보자!' },
    ],
  },
  {
    id: 'ch3-boss', trigger: { stage: 'CH15', when: 'before-start' }, title: '대왕 등장',
    lines: [
      { who: '구정물 대왕', face: 'boss-angry', text: '조금 쓰고 버린 건 너희잖아!' },
      { who: '구정물 대왕', face: 'boss-angry', text: '그래서 물고기들이 숨을 못 쉬어!' },
      { who: '민지', face: 'minji', stage: '고개 숙이며', text: '미안해. 우리가 몰랐어.' },
      { who: '개굴이', face: 'frog', stage: '떨면서 앞으로', text: '이, 이번엔 나도 도울래!' },
      { who: '호야', face: 'hoya', text: '가자! 서호 수호대, 정화 시작!' },
    ],
  },
  {
    id: 'ch3-clear', trigger: { stage: 'CH15', when: 'after-clear' }, title: '맑아진 개울',
    lines: [
      { who: '맑아진 대왕', face: 'boss-calm', text: '깨끗하게 해 줘서 고마워.' },
      { who: '민지', face: 'minji', text: '우리도 약속할게. 세제는 조금만!' },
      { who: '수달이', face: 'otter', stage: '물로 풍덩', text: '고마워!' },
      { who: '개굴이', face: 'frog', text: '대왕님, 안녕! 나도 용기가 생겼어.' },
      { who: '호야', face: 'hoya', text: '다음은 숲이야. 가자, 서호 수호대!' },
    ],
  },
];
