// HUD: 툴팁, 일시적인 상태 플래시, 연결 체크리스트, 사운드 토글, 컴팩트한 실행 카드.
//
// 이 모듈은 한때 이전 단계의 셀프밸런서 계측 — 기울기/PID 스파크라인, 라이브 Kp/Ki/Kd 슬라이더,
// 4단계 스테퍼, 미션 HUD — 까지 들고 있었습니다. 크리에이터 샌드박스에는 살아 있는 대응물이
// (밸런스 루프도 없고, PID도 없고, 미션도 없기 때문에) 없었기에 보이지 않게 돌고만 있는 죽은
// 짐이었습니다. 정리했습니다: 인스펙터가 전기 측정값을, 실행은 모터 테스트 + 리셋과 작업대
// 복귀를 담당합니다.
import { audio } from '../audio.js';
import { state } from './state.js';

export const KIND_LABEL = { power: '전원', ground: '그라운드', data: '신호' };

export function initHud({ wiring, onExitSim, onReset }) {
  const tooltip = document.getElementById('tooltip');
  const hudStatus = document.getElementById('hud-status');
  const checklistEl = document.getElementById('checklist');
  const uploadBtn = document.getElementById('upload-btn');
  const clearBtn = document.getElementById('clear-btn');

  // ── 툴팁 ──────────────────────────────────────────────────────
  function showTooltip(e, html, isError = false) {
    tooltip.innerHTML = html;
    tooltip.classList.toggle('error', isError);
    tooltip.classList.remove('hidden');
    moveTooltip(e);
  }
  function moveTooltip(e) {
    tooltip.style.left = (e.clientX + 14) + 'px';
    tooltip.style.top = (e.clientY + 14) + 'px';
  }
  function hideTooltip() { tooltip.classList.add('hidden'); }

  // 일시적인 상태 플래시
  let flashTimer = null;
  function flash(msg, kind) {
    hudStatus.textContent = msg;
    hudStatus.style.color = kind === 'ok' ? 'var(--green)' : kind === 'bad' ? 'var(--red)' : '';
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => { hudStatus.style.color = ''; }, 2200);
  }
  function setStatus(msg) { hudStatus.textContent = msg; }

  // ── 사운드 토글 ────────────────────────────────────────────────────
  const soundBtn = document.getElementById('sound-btn');
  function renderSoundBtn() {
    soundBtn.classList.toggle('muted', !audio.enabled);
    soundBtn.innerHTML = `<i data-lucide="${audio.enabled ? 'volume-2' : 'volume-x'}"></i>`;
    try { window.lucide?.createIcons(); } catch {}
  }
  soundBtn.addEventListener('click', () => { audio.resume(); audio.setEnabled(!audio.enabled); renderSoundBtn(); });

  // ── 빗소리 ambience ────────────────────────────────────────────────────
  // 사운드 음소거 토글과 의도적으로 분리: 일하는 동안 빗소리를 듣고 싶어하는 사람이
  // 꼭 클릭음을 끄고 싶어하는 건 아니며, 반대도 마찬가지. 470KB 루프는 첫 스위치를 켤 때만
  // 가져오므로, 사용 전까지 비용은 0입니다.
  const ambientBtn = document.getElementById('ambient-btn');
  if (ambientBtn) {
    const renderAmbient = () => {
      ambientBtn.classList.toggle('on', audio.ambientOn);
      ambientBtn.setAttribute('aria-pressed', audio.ambientOn ? 'true' : 'false');
    };
    ambientBtn.addEventListener('click', async () => {
      const next = !audio.ambientOn;
      if (next) ambientBtn.classList.add('loading');
      await audio.setAmbient(next);
      ambientBtn.classList.remove('loading');
      renderAmbient();
      // setAmbient은 가져오기에 실패하면 ambientOn을 지우므로 실제 상태를 읽음
      if (next && !audio.ambientOn) flash('앰비언트 트랙을 불러오지 못했어요', 'warn');
    });
    // 기억된 환경설정은 자동으로 시작할 수 없으므로 (자동재생에 동작이 필요)
    // 버튼은 그냥 사용 가능 상태로 표시되고 눌리기를 기다립니다.
    renderAmbient();
  }
  renderSoundBtn();

  // ── 체크리스트 ──────────────────────────────────────────────────
  function refreshChecklist() {
    const st = wiring.status();
    const doneN = st.filter(s => s.done).length;
    checklistEl.innerHTML =
      `<div class="check-item" style="color:var(--text)">${doneN}/${st.length} 연결됨</div>` +
      st.map(s => `<div class="check-item ${s.done ? 'done' : ''}">
          <span class="box">${s.done ? '☑' : '☐'}</span>${s.label}</div>`).join('');

    // 실행은 항상 활성화됨 — 위반은 게이트가 아니라 시뮬레이션 안에서 드러납니다.
    uploadBtn.disabled = false;
    clearBtn.disabled = state.mode === 'sim';
  }

  // ── 첫 방문자 오버레이 ────────────────────────────────────────
  const overlay = document.getElementById('overlay');
  document.getElementById('overlay-start').addEventListener('click', () => {
    overlay.classList.add('hidden');
    try { localStorage.setItem('sbl-seen', '1'); } catch {}
  });
  // 오버레이는 더 이상 인터스티셜이 아닙니다. 이전의 첫 방문자는
  // (그리고 그 다음의 코치까지) 빈 작업대 위에서 무언가를 만지기 전에 두 번 닫아야 했습니다 —
  // 결국 아무 일도 일어나지 않는 화면에 도달했습니다. main.js는 이제 콜드 오픈으로 살아 있는 회로를
  // 올리므로, 환영은 요청에 의한 도움말이 됩니다: ? 버튼이 그것을 엽니다.

  // ── 실행 카드 ────────────────────────────────────────────────
  // 문서 기반 모터 테스트: 인스펙터가 해석된 전류와 ω를 보여 주므로 여기에는
  // 제목과 두 버튼만 있으면 됩니다.
  const simHud = document.createElement('div');
  simHud.id = 'sim-hud';
  simHud.className = 'hidden';
  simHud.innerHTML = `
    <div class="sim-kicker">동작합니다!</div>
    <div class="sim-title">당신의 발명품이 움직이고 있어요</div>
    <p>속도는 당신이 만든 회로에서 나옵니다.</p>
    <div class="sim-buttons">
      <button id="reset-btn"><i data-lucide="rotate-ccw"></i><span>리셋</span></button>
      <button id="back-btn"><i data-lucide="arrow-left"></i><span>계속 만들기</span></button>
    </div>`;
  document.getElementById('workspace').appendChild(simHud);
  simHud.querySelector('#reset-btn').addEventListener('click', () => onReset?.());
  simHud.querySelector('#back-btn').addEventListener('click', () => onExitSim());

  // 정적 + 동적 마크업이 모두 갖춰졌으니 모든 Lucide 아이콘 렌더
  try { window.lucide?.createIcons(); } catch {}

  return {
    showTooltip, moveTooltip, hideTooltip, flash, setStatus,
    refreshChecklist, simHud,
  };
}
