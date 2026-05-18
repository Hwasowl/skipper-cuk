// 모의 LMS 플랫폼의 DOM 확정 후 실제 값으로 교체할 것.
// 기본값은 화면 캡처에서 관찰된 텍스트 기준 가정.
export const SELECTORS = {
  lectureCard: '[data-lecture-card]',
  cardTitle: '[data-lecture-title]',
  cardDuration: '[data-lecture-duration]',
  cardProgressText: '[data-lecture-progress-text]',
  cardProgressPercent: '[data-lecture-progress-percent]',
  studyButton: 'text=학습하기',
  endButton: 'text=출석(종료)',
  videoElement: 'video',
} as const;
