// 상단 바 셸 — 3패널 콕핏 위의 슬림한 제품 프레임. "데모"가 "제품"이 되도록 만듭니다:
// 브랜드 마크, 현재 작품 이름, 라이트/다크 테마 토글. 의도적으로 최소화; 작업 공간은
// 자체 사운드/도움말 버튼을 유지합니다.
//
// 칩은 활성 *로봇*을 이름 붙이는 데서 (이전의 RobotDef 레지스트리, 앱 부팅 시 고정 섀시 1개),
// 크리에이터 샌드박스에서는 작업 단위가 RobotDoc이므로 칩은 열린 작품을 이름 붙이고 이름
// 바꾸기 필드 역할도 합니다.
import { state, subscribe } from './state.js';

const THEME_KEY = 'sbl-theme';

export function initTopbar({ getName, onRename } = {}) {
  const bar = document.getElementById('topbar');
  if (!bar) return null;

  bar.innerHTML = `
    <div class="tb-brand">
      <span class="tb-mark" aria-hidden="true"><i data-lucide="sparkles"></i></span>
      <span class="tb-lockup"><span class="tb-name">셀프밸런스</span><span class="tb-sub">발명 스튜디오</span></span>
    </div>
    <button class="tb-robot" id="tb-robot" title="이 작품의 이름 바꾸기"><span class="tb-dot"></span><span id="tb-robot-name">작업대</span></button>
    <div class="tb-actions">
      <button id="tb-theme" class="tb-btn" title="라이트/다크 전환" aria-label="라이트/다크 전환">
        <i data-lucide="sun-moon"></i>
      </button>
    </div>`;

  // ── 테마 토글 (<html>의 data-theme; tokens.css가 셸을 다시 칠함) ──
  const root = document.documentElement;
  function applyTheme(t) {
    root.setAttribute('data-theme', t);
    try { localStorage.setItem(THEME_KEY, t); } catch { /* 무시 */ }
  }
  // 라이트가 기본이며, index.html에서 설정하여 첫 페인트가 이미 정확합니다.
  // 이는 실제로 테마를 고른 사용자에 한해 덮어쓰므로, 이전에 다크를 고른 방문자는 유지됩니다.
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved) root.setAttribute('data-theme', saved);
  } catch { /* 무시 */ }
  bar.querySelector('#tb-theme').addEventListener('click', () => {
    applyTheme(root.getAttribute('data-theme') === 'light' ? 'dark' : 'light');
  });

  // 칩은 열린 작품을 이름 붙이고 빌드/런 상태를 반영; 클릭하면 이름을 바꿈
  function refreshChip() {
    const chip = bar.querySelector('#tb-robot');
    const running = state.mode === 'sim';
    chip.classList.toggle('driving', running);
    const name = (getName && getName()) || '작업대';
    bar.querySelector('#tb-robot-name').textContent = name + (running ? ' — 실행 중' : '');
  }
  bar.querySelector('#tb-robot').addEventListener('click', () => {
    if (!onRename) return;
    const next = window.prompt('이 작품의 이름:', (getName && getName()) || '작업대');
    if (next && next.trim()) { onRename(next.trim()); refreshChip(); }
  });
  subscribe('mode', refreshChip);
  refreshChip();

  try { window.lucide?.createIcons(); } catch { /* 아이콘은 부가 기능 */ }
  return { refreshChip };
}
