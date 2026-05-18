// 실제 LMS DOM 분석 기반 셀렉터.
// 강의 목록 페이지: e-cyber.catholic.ac.kr/.../online_list_form.acl
// 플레이어 페이지: e-cyber.catholic.ac.kr/.../online_view_form.acl
export const SELECTORS = {
  // 강의 카드: <div id="lecture-NN" class="lecture-box">
  lectureCard: '.lecture-box',

  // 차시 제목 ("1차시 ", "2차시 " ...)
  cardTitle: "div[style*='font-size: 16px']",

  // "0:00 / 42:43" 형식의 진행 텍스트. duration은 이 안에서 분리한다.
  cardProgressText: "div[style*='margin-left: 7px']",

  // 진행률 "0%" / "100%". id="per_text"가 카드마다 중복되므로 카드에 chain해서 사용할 것.
  cardProgressPercent: "[id='per_text']",

  // 학습하기 버튼: <img class="view" src="/.../btn_start_learning.gif">
  studyButton: "img[src*='btn_start_learning']",

  // 출석(종료) 버튼. force_close_(숨김 사본)와 구분하기 위해 #close_ 사용.
  endButton: '#close_',

  // UniPlayer iframe 컨테이너 (cms.catholic.ac.kr — cross-origin)
  playerFrame: '#contentViewer',

  // iframe 안 중앙 큰 재생 버튼 (시청 시작 전 오버레이)
  playOverlay: '.vc-front-screen-play-btn',

  // iframe 안 하단 컨트롤바 재생/일시정지 (오버레이가 없을 때 fallback)
  playControlButton: '.vc-pctrl-play-pause-btn',
} as const;
