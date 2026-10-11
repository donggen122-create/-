// Add chapter scripts here; story.js renders the same UI for both game versions.
export const STORY_FACES = {
  minji: './assets/story/minji.png',
  hoya: './assets/story/hoya.png',
  otter: './assets/story/otter.png',
  frog: './assets/story/frog.png',
  'boss-angry': './assets/story/boss-angry.png',
  'boss-calm': './assets/story/boss-calm.png',
};
// docs/44_학생_활동지_반영_준비.md, section 1: approved polished draft, verbatim.
export const STORY_SCENES = [
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
