// 첫 실행 온보딩 코치 — 작고 소박한 "첫 회로 만들기" 체크리스트로, 무거운 튜토리얼 없이
// 핵심 루프(놓기 → 배선 → 실행)를 가르칩니다. 상태를 보유하지 않습니다: 각 단계의 "완료"
// 여부는 window.__api — 테스트와 헤파이스토스가 사용하는 동일한 표면 — 를 통해 라이브 문서와
// 전기 해석을 들여다보며 도출됩니다. 사용자가 완료(또는 닫기)하면 localStorage에 기억되어
// 다시 나타나지 않습니다.
import { baseType } from '../model/library.js';
import { state } from './state.js';

const SEEN_KEY = 'sbl-coached';

// 각 단계: 짧은 라벨, 선택 가능한 한 줄 힌트, 그리고 {doc, elec, mode}에 대한 술어.
// 단계는 순서대로 확인됩니다; 아직 끝나지 않은 첫 단계가 "현재" 단계이며 그 힌트를 보여 줍니다.
// `hint`는 데스크톱 콕핏(왼쪽의 트레이, 우상단의 실행)을 위한 표현입니다;
// `hintTouch`는 폰이 실제로 제시하는 같은 단계입니다 — 패널이 하단 시트이고 실행이 하단 바에
// 있으므로 데스크톱 표현은 사람을 화면의 잘못된 가장자리로 보내 버립니다.
const STEPS = [
  { label: '건전지를 작업대로 끌어오세요',
    hint: '왼쪽 부품 트레이에서 가져오세요.',
    hintTouch: '아래의 부품 패널을 열고 건전지를 작업대 위로 끌고 오세요.',
    done: ({ doc }) => hasType(doc, 'battery') },
  { label: '모터도 작업대로 끌어오세요',
    hint: '트레이에서 하나 더 — 회전할 부품입니다.',
    hintTouch: '부품에서 하나 더 — 회전할 부품입니다.',
    done: ({ doc }) => hasType(doc, 'motor') },
  { label: '건전지 +를 모터에 연결하세요',
    hint: '건전지의 + 핀을 클릭한 뒤, 모터의 핀 하나를 클릭해 연결합니다.',
    hintTouch: '건전지의 + 핀을 탭한 뒤, 모터의 핀을 탭해 연결합니다.',
    done: ({ doc }) => wired(doc, 'power+', 'motor') },
  { label: '전류가 흐르도록 회로를 닫으세요',
    hint: '건전지 −도 모터로 연결하세요. 인스펙터에 전류가 나타납니다.',
    hintTouch: '건전지 −를 모터에 연결하세요. 회로(하단 바)에 전류가 표시됩니다.',
    done: ({ elec }) => currentFlows(elec) },
  { label: '실행 버튼을 눌러 회전을 지켜보세요',
    hint: '우상단의 실행을 눌러 물리 시뮬레이션으로 들어가세요.',
    hintTouch: '우하단의 실행을 눌러 물리 시뮬레이션으로 들어가세요.',
    done: ({ mode }) => mode === 'sim' },
];

// 거친 포인터 ⇒ 폰/태블릿 표현
const TOUCH = (() => { try { return window.matchMedia('(pointer: coarse)').matches; } catch { return false; } })();
const hintFor = (s) => (TOUCH && s.hintTouch) || s.hint || '';

// 건전지의 양극 핀(+ / −)이 모터의 어느 핀이든 같은 넷 위에 있나요?
function wired(doc, role, targetType) {
  const batPins = pinsWithRole(doc, 'battery', role);
  const motorEps = new Set(epsOfType(doc, targetType));
  return doc.nets.some(n => n.endpoints.some(e => batPins.has(e)) &&
    n.endpoints.some(e => motorEps.has(e)));
}
function hasType(doc, type) { return doc.components.some(c => baseType(c.type) === type); }
function currentFlows(elec) {
  return Object.values(elec.current || {}).some(i => Math.abs(i) > 0.01);
}
function pinsWithRole(doc, type, role) {
  // 알려진 라이브러리 역할로 매핑: 건전지 +는 power+, −는 power-
  const wanted = role === 'power+' ? '+' : '-';
  const out = new Set();
  for (const c of doc.components) if (baseType(c.type) === type) out.add(`${c.id}.${wanted}`);
  return out;
}
function epsOfType(doc, type) {
  const out = [];
  for (const c of doc.components) if (baseType(c.type) === type) out.add(`${c.id}.A`, `${c.id}.B`);
  return out;
}

export function initCoach(api) {
  const host = document.getElementById('coach');
  const list = document.getElementById('coach-steps');
  if (!host || !list) return { stop() {} };

  let seen = false;
  try { seen = localStorage.getItem(SEEN_KEY) === '1'; } catch { /* 무시 */ }
  if (seen) return { stop() {} };

  list.innerHTML = STEPS.map((s, i) =>
    `<li data-i="${i}">
       <span class="coach-check">○</span>
       <span class="coach-body">
         <span class="coach-label">${s.label}</span>
         <span class="coach-hint">${hintFor(s)}</span>
       </span>
     </li>`).join('');

  // 헤파이스토스가 모든 것을 만들어 줄 수 있다는 친근한 넛지 — 학습 곡선을 평평하게.
  // 단계 아래에 한 번만 끼워 넣음.
  const nudge = document.createElement('div');
  nudge.className = 'coach-nudge';
  nudge.innerHTML = `처음이신가요? <button type="button" class="coach-ask" ` +
    `aria-label="헤파이스토스를 열고 회로를 만들어 달라고 부탁하기">헤파이스토스에게 만들어 달라고 부탁하기 ✨</button>`;
  host.appendChild(nudge);
  nudge.querySelector('.coach-ask')?.addEventListener('click', () => {
    // 헤파이스토스를 열고 시작 프롬프트를 채워 넣음; 그냥 DOM이며 결합이 없음.
    const jv = document.getElementById('hephaestus');
    jv?.classList.remove('collapsed');
    const inp = document.getElementById('hephaestus-input');
    if (inp) { inp.value = '건전지를 모터에 연결하고 실행해 줘'; inp.focus(); }
  });

  host.classList.remove('hidden');

  // ── 최소화 ⇄ 복원: 탭은 왼쪽 가장자리에 도킹된 작은 칩으로 줄어들 수 있고 (애니메이션),
  // 칩을 클릭하면 다시 펼쳐집니다 — 작은 조수가 옆으로 줄었다 다시 튀어 오르는 것처럼.
  // 영구 제거(✕)인 dismiss와 분리됨. ──
  const head = host.querySelector('.coach-head');
  const minBtn = document.createElement('button');
  minBtn.id = 'coach-min';
  minBtn.type = 'button';
  minBtn.title = '최소화';
  minBtn.setAttribute('aria-label', '가이드를 옆으로 최소화');
  minBtn.textContent = '–';
  // 닫기 ✕ 바로 앞에 자리
  head.insertBefore(minBtn, document.getElementById('coach-dismiss'));

  const workspace = host.parentElement;   // #workspace (position:relative)
  const chip = document.createElement('button');
  chip.id = 'coach-chip';
  chip.type = 'button';
  chip.className = 'hidden';
  chip.title = '가이드 다시 보기';
  chip.setAttribute('aria-label', '만들기 가이드 다시 보기');
  chip.innerHTML = `<span class="coach-chip-dot">◐</span><span class="coach-chip-label">가이드</span>`;
  workspace.appendChild(chip);

  function minimize() {
    host.classList.add('minimized');   // CSS가 옆으로 애니메이션 + 숨김
    chip.classList.remove('hidden');
    requestAnimationFrame(() => chip.classList.add('in'));
  }
  function restore() {
    chip.classList.remove('in');
    chip.classList.add('hidden');
    host.classList.remove('minimized');
  }
  minBtn.addEventListener('click', minimize);
  chip.addEventListener('click', restore);

  // ── 헤더를 잡고 탭을 드래그 (버튼은 무시) ──
  let drag = null;
  head.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;   // ✕ / – 가 동작하도록 둠
    const r = host.getBoundingClientRect();
    const pr = workspace.getBoundingClientRect();
    drag = { dx: e.clientX - r.left, dy: e.clientY - r.top, pr };
    host.classList.add('dragging');
    host.style.transform = 'none';            // translateX 중앙 정지
    head.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  });
  head.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const { pr } = drag;
    let left = e.clientX - pr.left - drag.dx;
    let top = e.clientY - pr.top - drag.dy;
    // 작업 공간 안에 머무르도록
    left = Math.max(6, Math.min(left, pr.width - host.offsetWidth - 6));
    top = Math.max(6, Math.min(top, pr.height - 40));
    host.style.left = `${left}px`;
    host.style.top = `${top}px`;
  });
  const endDrag = () => { if (drag) { drag = null; host.classList.remove('dragging'); } };
  head.addEventListener('pointerup', endDrag);
  head.addEventListener('pointercancel', endDrag);

  let done = false;
  function dismiss() {
    if (done) return;
    done = true;
    host.classList.add('hidden');
    chip.classList.add('hidden');
    try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* 무시 */ }
    clearInterval(timer);
  }
  document.getElementById('coach-dismiss')?.addEventListener('click', dismiss);

  function render() {
    const ctx = {
      doc: safe(() => api.get_document(), { components: [], nets: [] }),
      elec: safe(() => api.read_electrical(), { current: {} }),
      mode: state.mode,
    };
    // 술어가 거짓인 첫 단계가 "현재" 단계; 그 이전 단계는 모두 완료로 표시
    let current = STEPS.length;
    for (let i = 0; i < STEPS.length; i++) {
      if (!safe(() => STEPS[i].done(ctx), false)) { current = i; break; }
    }
    [...list.children].forEach((li, i) => {
      const isDone = i < current;
      li.classList.toggle('done', isDone);
      li.classList.toggle('current', i === current);
      li.querySelector('.coach-check').textContent = isDone ? '✓' : (i === current ? '▸' : '○');
    });
    if (current >= STEPS.length && !host.classList.contains('coach-complete')) {
      celebrate();
    }
  }

  function celebrate() {
    host.classList.add('coach-complete');
    nudge.remove();
    const banner = document.createElement('div');
    banner.className = 'coach-done';
    banner.innerHTML = `🎉 <b>잘했어요 — 첫 회로가 살아났어요!</b>` +
      `<span>그게 전부예요: 놓기 → 배선 → 실행. 여기서부터 무엇이든 만들어 보세요.</span>`;
    host.appendChild(banner);
    setTimeout(dismiss, 3600);
  }

  render();
  const timer = setInterval(render, 500);
  // reopen(): 최소화되었으면 탭을 다시 가져옴 (상단 "?" 도움말 버튼이 사용).
  // 영구 제거된 뒤에는 아무 일도 하지 않음.
  function reopen() { if (!done) restore(); }
  return { stop: () => clearInterval(timer), dismiss, minimize, reopen };
}

function safe(fn, fallback) { try { return fn() ?? fallback; } catch { return fallback; } }
