// 예제 회로 — 첫 LED부터 실제 물리 입력을 가진 센서 회로까지, 즉시 만들어 볼 수 있는
// 작품의 갤러리. 하나를 고르면 작업대를 비우고 동일한 window.__api(place_component + connect)를
// 통해 다시 쌓습니다. 즉, 예제는 특별한 로딩 경로가 없는 스크립팅된 사용자에 불과합니다.
import { state } from './state.js';

// 각 프리셋은 부품(type + 안정 id + 옵션 파라미터)과 배선(endpoint 쌍 "id.pin")을 나열.
// 위치는 로드 시 그리드에 자동 배치.
export const EXAMPLES = [
  {
    id: 'led-torch', tier: '초급', title: 'LED 손전등',
    blurb: '건전지 → 저항 → LED. 저항이 LED가 타지 않게 지켜 줍니다.',
    parts: [
      { type: 'battery', id: 'bat1' },
      { type: 'resistor', id: 'res1', params: { resistance: 220 } },
      { type: 'led', id: 'led1' },
    ],
    wires: [['bat1.+', 'res1.A'], ['res1.B', 'led1.A'], ['led1.K', 'bat1.-']],
  },
  {
    id: 'switch-lamp', tier: '초급', title: '전구 스위치',
    blurb: '전구와 직렬로 연결된 스위치. 작업대 위 스위치를 클릭해 토글해 보세요.',
    parts: [
      { type: 'battery', id: 'bat1' },
      { type: 'switch', id: 'sw1', params: { closed: true } },
      { type: 'lamp', id: 'lamp1' },
    ],
    wires: [['bat1.+', 'sw1.A'], ['sw1.B', 'lamp1.A'], ['lamp1.B', 'bat1.-']],
  },
  {
    id: 'button-buzzer', tier: '초급', title: '버튼식 버저',
    blurb: '푸시 버튼을 누르고 있는 동안에만 회로가 닫혀 버저가 울립니다.',
    parts: [
      { type: 'battery', id: 'bat1' },
      { type: 'push_button', id: 'btn1', params: { closed: true } },
      { type: 'buzzer', id: 'buz1' },
    ],
    wires: [['bat1.+', 'btn1.A'], ['btn1.B', 'buz1.+'], ['buz1.-', 'bat1.-']],
  },
  {
    id: 'pot-dimmer', tier: '중급', title: '모터 속도 조절기',
    blurb: '모터와 직렬로 연결된 가변저항 — 노브를 스크롤해 속도를 바꿔 보세요.',
    parts: [
      { type: 'battery', id: 'bat1' },
      { type: 'potentiometer', id: 'pot1', params: { resistance: 40 } },
      { type: 'motor', id: 'mot1' },
    ],
    wires: [['bat1.+', 'pot1.A'], ['pot1.B', 'mot1.A'], ['mot1.B', 'bat1.-']],
  },
  {
    id: 'parallel-leds', tier: '중급', title: '병렬로 연결된 두 개의 LED',
    blurb: '하나의 저항이 공통 노드를 공유하는 두 LED에 전류를 공급합니다 — 병렬 분기가 어떻게 전류를 나누는지 보세요.',
    parts: [
      { type: 'battery', id: 'bat1' },
      { type: 'resistor', id: 'res1', params: { resistance: 150 } },
      { type: 'led', id: 'led1' },
      { type: 'led', id: 'led2' },
    ],
    wires: [
      ['bat1.+', 'res1.A'],
      ['res1.B', 'led1.A'], ['res1.B', 'led2.A'],
      ['led1.K', 'bat1.-'], ['led2.K', 'bat1.-'],
    ],
  },
  {
    id: 'diode-oneway', tier: '중급', title: '다이오드: 일방향 밸브',
    blurb: '다이오드는 A→K 방향으로만 전류를 흘립니다. 순방향으로 연결하면 전구가 켜지고, 다이오드를 회전(R)시키면 꺼집니다.',
    parts: [
      { type: 'battery', id: 'bat1' },
      { type: 'diode', id: 'dio1' },
      { type: 'lamp', id: 'lamp1' },
    ],
    wires: [['bat1.+', 'dio1.A'], ['dio1.K', 'lamp1.A'], ['lamp1.B', 'bat1.-']],
  },
  {
    id: 'fuse-blow', tier: '중급', title: '퓨즈와 과부하',
    blurb: '저저항 전구가 1A 퓨즈 정격보다 더 많은 전류를 끌어다 씁니다 — 인스펙터가 과전류를 알려 줍니다.',
    parts: [
      { type: 'battery', id: 'bat1' },
      { type: 'fuse', id: 'fus1', params: { maxCurrent: 1 } },
      { type: 'lamp', id: 'lamp1', params: { resistance: 4 } },
    ],
    wires: [['bat1.+', 'fus1.A'], ['fus1.B', 'lamp1.A'], ['lamp1.B', 'bat1.-']],
  },
  {
    id: 'relay-motor', tier: '고급', title: '릴레이로 제어되는 모터',
    blurb: '릴레이 접점(COM→NO)이 모터를 스위치합니다. 릴레이를 토글해 여자시켜 보세요.',
    parts: [
      { type: 'battery', id: 'bat1' },
      { type: 'relay', id: 'rel1', params: { closed: true } },
      { type: 'motor', id: 'mot1' },
    ],
    wires: [['bat1.+', 'rel1.COM'], ['rel1.NO', 'mot1.A'], ['mot1.B', 'bat1.-']],
  },
  {
    id: 'thermal-candle', tier: '물리 입력', title: '🔥 열 감지 전구',
    blurb: '서미스터와 전구. 차가울 때 저항이 높아 전구가 어둡습니다 — 양초를 가까이 가져가면 전구가 켜집니다.',
    note: '작업대 위에 나타난 양초를 서미스터 가까이로 끌고 가서 가열하세요.',
    parts: [
      { type: 'battery', id: 'bat1' },
      { type: 'thermistor', id: 'thr1', params: { resistance: 3000, maxResistance: 3000 } },
      { type: 'lamp', id: 'lamp1' },
    ],
    wires: [['bat1.+', 'thr1.A'], ['thr1.B', 'lamp1.A'], ['lamp1.B', 'bat1.-']],
  },
  {
    id: 'light-ldr', tier: '물리 입력', title: '💡 빛 감지 LED',
    blurb: '광저항과 LED. 어둠에서는 저항이 높아 LED가 꺼져 있습니다 — 전구를 비추면 LED가 켜집니다.',
    note: '작업대 위에 나타난 전구를 광저항 위로 끌고 가 빛을 비춰 보세요.',
    parts: [
      { type: 'battery', id: 'bat1' },
      { type: 'photoresistor', id: 'ldr1', params: { resistance: 3000, maxResistance: 3000 } },
      { type: 'resistor', id: 'res1', params: { resistance: 150 } },
      { type: 'led', id: 'led1' },
    ],
    wires: [['bat1.+', 'ldr1.A'], ['ldr1.B', 'res1.A'], ['res1.B', 'led1.A'], ['led1.K', 'bat1.-']],
  },
];

export function initExamples({ api, hud, onLoad, exitSim } = {}) {
  const workspace = document.getElementById('workspace');
  if (!workspace) return { load() {} };

  // 시작 버튼
  const btn = document.createElement('button');
  btn.id = 'examples-btn';
  btn.type = 'button';
  btn.title = '아이디어 더미에서 시도해 보기';
  btn.innerHTML = `<i data-lucide="lightbulb"></i><span>아이디어 더미</span>`;
  workspace.appendChild(btn);

  // 팝오버 패널
  const panel = document.createElement('div');
  panel.id = 'examples-panel';
  panel.className = 'hidden';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', '아이디어 더미');

  const tiers = [...new Set(EXAMPLES.map(e => e.tier))];
  panel.innerHTML =
    `<div class="ex-head"><span><small>영감이 필요한가요?</small><b>하나의 발명품을 시도해 보세요</b></span>` +
    `<button class="ex-close" aria-label="닫기">✕</button></div>` +
    `<div class="ex-body">` +
    tiers.map(tier =>
      `<div class="ex-group"><div class="ex-tier">${tier}</div>` +
      EXAMPLES.filter(e => e.tier === tier).map(e =>
        `<button class="ex-item" data-id="${e.id}">` +
        `<span class="ex-title">${e.title}</span>` +
        `<span class="ex-blurb">${e.blurb}</span></button>`).join('') +
      `</div>`).join('') +
    `</div>`;
  workspace.appendChild(panel);
  try { window.lucide?.createIcons(); } catch { /* 아이콘은 부가 기능 */ }

  function open() { panel.classList.remove('hidden'); }
  function close() { panel.classList.add('hidden'); }
  btn.addEventListener('click', () => panel.classList.toggle('hidden'));
  panel.querySelector('.ex-close').addEventListener('click', close);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

  function load(preset, { silent = false } = {}) {
    if (state.mode === 'sim') exitSim?.();
    // 작업대에 무엇이든 비우기
    for (const c of api.get_document().components) api.remove_component({ id: c.id });
    // 부품이 서로 쌓이지 않도록 느슨한 그리드에 배치 (작업대 물리가 자리를 잡음)
    const cols = 4;
    preset.parts.forEach((p, i) => {
      const gx = ((i % cols) - (cols - 1) / 2) * 10;
      const gz = (Math.floor(i / cols) - 0.5) * 10;
      const r = api.place_component({
        type: p.type, id: p.id, params: p.params,
        transform: { pos: [gx, 2, gz], rot: [0, 0, 0] },
      });
      if (!r.ok) hud?.flash?.(`${p.type}을(를) 놓지 못했어요: ${r.errors?.[0] || ''}`, 'bad');
    });
    for (const [from, to] of preset.wires) api.connect({ from, to });
    if (!silent) hud?.flash?.(`${preset.title} 불러옴`, 'ok');
    if (preset.note) hud?.setStatus?.(preset.note);
    onLoad?.(preset);
    close();
  }

  panel.querySelectorAll('.ex-item').forEach(el => {
    el.addEventListener('click', () => {
      const preset = EXAMPLES.find(e => e.id === el.dataset.id);
      if (preset) load(preset);
    });
  });

  return { load, open, close };
}
