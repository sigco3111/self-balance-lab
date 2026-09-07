// Orchestrator: creates the scene + core systems, wires the app modules
// together (assembly, hud, inspector), owns RUN/back transitions + render loop.
import { createScene } from './scene.js';
import { loadRapier } from './sim/rapier.js';
import { audio } from './audio.js';
import { state, set } from './app/state.js';
import { initHud } from './app/hud.js';
import { initCreatorAssembly } from './app/creator-assembly.js';
import { initBenchSplat } from './app/bench-splat.js';
import { initBenchRoom } from './app/bench-room.js';
import { initBenchScan } from './app/bench-scan.js';
import { createApi } from './api/index.js';
import { emptyDoc } from './model/doc.js';
import { CreatorSim } from './sim/creator-sim.js';
import { initDocSave } from './app/docsave.js';
import { initInspector } from './app/inspector.js';
import { initExamples, EXAMPLES } from './app/examples.js';
import { initHephaestus } from './app/hephaestus.js';
import { initCoach } from './app/coach.js';
import { initPerf } from './app/perf.js';
import { initTopbar } from './app/topbar.js';
import { initMobileUI } from './app/mobile.js';
import { initProductMotion } from './app/motion.js';
import { installErrorBoundary, isWebGLAvailable, showFatal } from './app/errors.js';
import { migrateStorageKeys } from './app/storage.js';
import { track, trackOnce, EVENTS, initAnalytics } from './app/analytics.js';
import { initAccount } from './app/account.js';
import { initClassroom } from './app/classroom.js';
import { pullDocument, flushQueue, getProfile } from './app/cloud.js';

installErrorBoundary();  // global error/rejection reporting + fatal fallback wiring
migrateStorageKeys();    // carry pre-rename saved state onto the sbl-* keys (once)
initAnalytics();         // attach the PostHog sink (privacy-locked; buffers until ready)
if (!isWebGLAvailable()) {
  // 3D can't run at all — show the friendly fallback instead of a blank canvas.
  showFatal();
  throw new Error('WebGL unavailable — halting boot.');
}

initPerf();   // dev-only FPS/startup HUD (?perf or Alt+P); no-op otherwise
// product-frame shell: brand, build name, theme toggle. The name getter is lazy
// because the API (which owns the document) is created further down.
const topbar = initTopbar({
  getName: () => window.__api?.get_document?.().name,
  onRename: (name) => window.__api?.set_name?.({ name }),
});

// unlock audio on first interaction (browser autoplay policy)
window.addEventListener('pointerdown', () => audio.resume(), { once: false });

const canvas = document.getElementById('three-canvas');
let sceneBits;
try {
  sceneBits = createScene(canvas);
} catch (e) {
  // context creation can still fail past the capability check (blocklisted GPU,
  // exhausted contexts) — fall back gracefully instead of a half-dead page.
  showFatal();
  throw e;
}
const { renderer, scene, camera, controls, resize, composer, floorUniforms, assemblyDecor, bloom, studioLights, setTheme } = sceneBits;

// ── 3D 무대를 테마에 맞춰 유지 ──────────────────────────────────────────────
// topbar.js가 토글을 소유하고 <html>에 data-theme을 씀; 3D 뷰가 그걸 완전히 무시해서
// 라이트 모드가 영원히 어두운 작업대를 감싼 라이트 셸이었습니다. 속성을 콜백 대신
// 관찰하면 두 모듈이 서로 알 필요가 없습니다 — topbar는 장면이 있는지 몰라도 되고,
// 테마를 뒤집는 다른 무엇도 동작합니다.
function syncSceneTheme() {
  setTheme(document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark');
}
new MutationObserver(syncSceneTheme).observe(document.documentElement, {
  attributes: true, attributeFilter: ['data-theme'],
});
syncSceneTheme();   // 부팅: localStorage가 복원한 테마를 존중
// Feed the renderer to the perf HUD so it can show draw-call/triangle counts (no-op when the HUD is off).
window.__perf?.setRenderer?.(renderer);
// Optional captured-room backdrop (Gaussian splat). Inert unless a splat is
// supplied via ?splat=<url> / window.__benchSplat — costs nothing otherwise.
window.__benchSplatApi = initBenchSplat({ scene, renderer, assemblyDecor });
// Modeled desk-room workbench (replica of the reference photo). It replaces the
// abstract "instrument studio" backdrop: hide the shader floor / chassis plate /
// sky dome and swap in the room, keeping the shadow-catcher so parts still cast
// contact shadows on the marble. assemblyDecor drives the sim-mode show/hide, so
// pushing the room group into it means RUN hides the whole room in one shot.
const benchRoom = initBenchRoom({ scene, renderer, bloom, studioLights });
const [studioFloor, shadowCatcher, studioChassis, studioSky] = assemblyDecor;
[studioFloor, studioChassis, studioSky].forEach((m) => { if (m) m.visible = false; });
scene.fog = null; // the room encloses the view; the studio fog would gray it out
assemblyDecor.length = 0;
assemblyDecor.push(shadowCatcher, benchRoom.group);
window.__benchRoom = benchRoom;
window.__view = { camera, controls, scene, renderer, setTheme }; // dev hook: camera, and the handles the theme test needs

// Scan variant of the room (the augmented photogrammetry mesh) + a click-to-swap
// toggle. In Scan mode the captured counter itself is the bench — bench-scan
// lands its detected countertop on y = 0 (the plane parts rest on) — so BOTH the
// modeled decor and the procedural marble slab hide; only the lights are shared.
// The scan group rides in assemblyDecor so RUN hides it too.
//
// 라이브 사이트에선 숨김: 모델링된 룸이 품질에서 이겼고 캡처는 모든 첫 방문자가
// 토글을 찾으려 한 적 없는 3.9MB glTF였습니다 — 바로 학교 네트워크 차단 기준이
// 켜지는 페이로드지요. 저작 작업용으로는 여전히 한 쿼리 파라미터 거리(?scan으로
// 보기, ?scanfit는 bench-scan.js의 리베이크 플로)이며, 꺼져 있을 땐 절대 만들지
// 않으니 다운로드도 일어나지 않습니다.
const SCAN_ENABLED = /[?&]scan(fit)?\b/.test(window.location.search);
const benchScan = SCAN_ENABLED
  ? initBenchScan({ scene })
  : { group: null, show() {}, hide() {}, isLoaded: () => false };
if (benchScan.group) assemblyDecor.push(benchScan.group);
// 모델링된 룸이 이제 기본입니다 — 평면 절차적 폴 스탠드인 캡처가 두드러졌을 때보다
// 진짜 자료·glTF 소품·HDRI 조명을 갖춘 PBR 재구성이라서; 토글은 여전히 캡처 메쉬로
// 바꿉니다.
const ROOM_KEY = 'sbl-room-mode';
// 숨기기 전의 오래된 'scan' 선택이 절대 로드되지 않을 룸에 방문자를 남겨두지 말기 —
// 저장된 환경설정은 활성화되었을 때만 유효.
let roomIsScan = SCAN_ENABLED && localStorage.getItem(ROOM_KEY) === 'scan';
function setRoomMode(scan) {
  roomIsScan = scan;
  try { localStorage.setItem(ROOM_KEY, scan ? 'scan' : 'modeled'); } catch { /* 프라이빗 모드 */ }
  benchRoom.props.visible = !scan;
  benchRoom.bench.visible = !scan;
  if (scan) benchScan.show(); else benchScan.hide();
  const btn = document.getElementById('room-toggle');
  if (btn) btn.querySelector('span:last-child').textContent = scan ? '스캔' : '모델링';
}
(function mountRoomToggle() {
  if (!SCAN_ENABLED) { setRoomMode(false); return; }   // 바꿀 게 없음
  const ws = document.getElementById('workspace');
  if (!ws) return;
  const btn = document.createElement('button');
  btn.id = 'room-toggle';
  btn.type = 'button';
  btn.title = '손 모델링 룸과 캡처된 3D 스캔 사이를 전환';
  btn.innerHTML = '<span aria-hidden="true">⇄</span><span>모델링</span>';
  btn.addEventListener('click', () => setRoomMode(!roomIsScan));
  ws.appendChild(btn);
  setRoomMode(roomIsScan);   // 기본/저장된 선택을 라벨이 존재한 뒤 한 번 적용
})();
window.__benchScan = benchScan;
window.__setRoomMode = setRoomMode;


const creatorSim = new CreatorSim(scene);   // the doc-driven motor body
window.__sim = creatorSim;   // debug/testing hook — tests poll motor ω here

const controlsLegend = document.getElementById('controls-legend');

// forward-declared: the fused build surface is created after the API (below),
// but hud/adapters close over it — a null-initialized binding avoids the TDZ.
let assemblyApi = null;

// checklist/stepper adapter: hud reads "wiring status" off the live document
// (the fused assembly is the authority; created just below).
const wiringAdapter = {
  status: () => (assemblyApi ? assemblyApi.wireStatus() : []),
  allRequiredDone: () => (assemblyApi ? assemblyApi.allWired() : false),
};

// hud is created first with lazy getters into the not-yet-created assembly module
const hud = initHud({
  wiring: wiringAdapter,
  onExitSim: () => exitSim(),
  onReset: () => creatorSim.reset(),   // Reset re-zeroes the spinning wheel
});

// ── scriptable API (window.__api) — the single mutation authority ─
// UI actions and tests both drive this; the DOM layer holds no mutation logic.
const api = createApi({
  doc: emptyDoc(),
  hooks: {
    // any document change (drag, wire, clear, undo, redo, a script, a #build=
    // load) re-syncs the 3D view — the doc is the single source of truth.
    // The checklist used to refresh only from creator-assembly's own pointer
    // handlers, so a build that arrived any other way — a seeded cold open, a
    // #build= link, a Hephaestus tool call, undo/redo — left the CONNECTIONS panel
    // showing its 'place all parts' placeholder over a fully wired circuit.
    // Hanging it here means it follows the document, like everything else.
    onDocChange: () => {
      assemblyApi?.sync(); topbar?.refreshChip(); hud?.refreshChecklist(); checkActivation();
    },
    sim: {
      run: () => enterSim(),
      stop: () => exitSim(),
      reset: () => creatorSim.reset(),
      running: () => state.mode === 'sim',
    },
    telemetry: () => {
      // telemetry is the creator body's per-motor ω (Inspector readout).
      const t = creatorSim.telemetry ? creatorSim.telemetry() : {};
      const omega = {};
      for (const id in t) omega[id] = t[id].omega;
      return { omega };
    },
  },
});
window.__api = api;

// ── activation metric: "first working circuit" ───────────────────
// The single number the funnel is built around. Fires the first time the solver
// reports a valid circuit with real current flowing through a *load* — a battery
// alone doesn't count, and neither does a wiring attempt that shorts. Cheap to
// evaluate (it rides the existing onDocChange, not a poll) and it can't be
// reached by clicking around, which is exactly why it's the metric worth quoting.
const SOURCE_TYPES = new Set(['battery']);
const MIN_CURRENT = 1e-4;   // 0.1 mA — above solver noise, below any real load
// The cold open (below) seeds a circuit that already solves, so on a first visit
// the solver reports a working circuit before the visitor has touched anything.
// That must NOT count as activation — the whole worth of this metric is that it
// can only be reached by actually building something. So the seeded topology is
// fingerprinted and the metric stays suppressed for exactly as long as the bench
// still holds that untouched seed. Adding a part, wiring, deleting, or clearing
// the board all change the fingerprint and arm the metric; merely turning the
// seeded potentiometer's knob (a set_param, same topology) deliberately does not.
let seedPrint = null;
let seeding = false;    // true only while the cold open is laying the seed down
function topologyPrint(doc) {
  const comps = doc.components.map(c => `${c.id}:${c.type}`).sort().join(',');
  const nets = doc.nets.map(n => [...n.endpoints].sort().join('|')).sort().join(';');
  return `${comps}/${nets}`;
}
function checkActivation() {
  try {
    if (seeding) return;
    const doc = api.get_document();
    if (seedPrint !== null && topologyPrint(doc) === seedPrint) return;
    const e = api.read_electrical();
    if (!e || !e.ok) return;
    const loaded = doc.components.some(
      (c) => !SOURCE_TYPES.has(c.type) && Math.abs(e.current?.[c.id] || 0) > MIN_CURRENT);
    if (!loaded) return;
    trackOnce(EVENTS.CIRCUIT_OK, {
      components: doc.components.length,
      nets: doc.nets.length,
      ms_since_load: Math.round(performance.now()),
    });
  } catch { /* the funnel must never break the build */ }
}

// the fused build surface: placement + wiring as a pure view over api.get_document().
// Created after the API so its onDocChange → sync loop is wired both ways.
assemblyApi = initCreatorAssembly({ canvas, scene, camera, controls, api, hud, benchRoom });
// live ω from the running sim → the solver's back-EMF input (Inspector readout)
creatorSim.onOmega((tel) => api.setSimState(tel));
// RobotDoc v2 persistence + shareable #build= link (v1 saves migrate on load)
const docSave = initDocSave(api, { onFlash: (m, k) => hud.flash(m, k) });
// Inspector: read-only DOM view of the live document + electrical solve (the M1
// replacement for the Guide rail). Polls the API; owns no state of its own.
initInspector(api, { getMode: () => state.mode });
// Example-circuit gallery — scripted builds (incl. the candle/thermistor and
// photoresistor "physical input" demos) loaded through the same API.
const examples = initExamples({ api, hud, exitSim: () => exitSim() });

// ── cold open ───────────────────────────────────────────
// A first-time visitor used to land on an empty bench behind a welcome modal,
// with the coach's checklist on top of that: two dismissals to reach a scene
// where nothing was happening and nothing showed what the product does. If
// there is no build to restore (no #build=, no save), seed a live one instead
// — battery → potentiometer → motor, already solving, wheel already turning,
// with a knob you can scroll to change the speed. The first interaction is
// therefore "turn this and watch it react", which needs no instructions.
// Anyone who wants the blank bench is one Clear board away.
// The camera is not touched here: frameBench() at the end of boot composes the
// same bench shot for every device, and the seeded circuit sits inside it.
const coldOpened = api.get_document().components.length === 0 &&
  (() => {
    const demo = EXAMPLES.find(e => e.id === 'pot-dimmer');
    if (!demo) return false;
    seeding = true;
    try { examples.load(demo, { silent: true }); } finally { seeding = false; }
    return true;
  })();
// Fingerprint what the cold open put on the bench, so checkActivation() can tell
// "the seed, untouched" from "a circuit this visitor built".
if (coldOpened) seedPrint = topologyPrint(api.get_document());

// First-run onboarding coach — a 5-step build-your-first-circuit checklist that
// advances by watching real API state; self-retires once done (persisted).
// Skipped on a cold open: its first four steps are already satisfied by the
// seeded circuit, so it would open on "press RUN" with no context for what the
// other steps were.
const coach = coldOpened ? null : initCoach(api);
// Hephaestus: natural-language build assistant (M2). Acts only through the API.
// Free/anon users are quota-capped (protects the shared Gemini free key); pro
// (profiles.tier) is uncapped. currentTier is updated on sign-in below.
let currentTier = 'free';
// 헤파이스토스 init은 비동기 — 백엔드 가용성(정적 호스팅 vs Edge Function)을 부팅 시 한 번 확인.
// 정적 호스팅이면 입력·버튼을 비활성화하고 안내문을 띄우므로 405가 더 이상 보이지 않음.
const hephaestus = await initHephaestus({
  api,
  onFlash: (m, k) => hud.flash(m, k),
  getTier: () => currentTier,
  onUpgrade: () => { track('upgrade_click', { from: 'hephaestus' }); hud.flash('무제한 헤파이스토스 — 곧 출시 예정', 'ok'); },
});
{
  const panel = document.getElementById('hephaestus');
  document.getElementById('hephaestus-toggle')?.addEventListener('click', () => {
    panel?.classList.toggle('collapsed');
    if (!panel?.classList.contains('collapsed')) document.getElementById('hephaestus-input')?.focus();
  });
}

document.getElementById('help-btn')?.addEventListener('click', () => {
  // 가이드를 닫았으면 다시 가져옴; 없으면 환영 화면을 표시.
  coach?.reopen?.();
  document.getElementById('overlay')?.classList.remove('hidden');
});

// ── phone shell ─────────────────────────────────────────────────
// Below 820px the three-column cockpit becomes a full-bleed bench + a bottom
// sheet + a RUN bar (js/app/mobile.js). The layout changes the canvas' size, so
// every transition re-runs resize() and re-frames the bench for the new aspect.
const mobileUI = initMobileUI({
  onLayoutChange: (reason) => requestAnimationFrame(() => {
    resize();
    // only a real layout swap changes the canvas' shape — re-framing on every
    // sheet toggle would throw away wherever the user had orbited to
    if ((reason === 'enter' || reason === 'leave') && state.mode === 'assembly') frameBench();
  }),
});
window.__mobile = mobileUI;
initProductMotion();

// The legend teaches mouse verbs (right-click, R, scroll) that don't exist on a
// touch screen. Coarse pointers get the gestures creator-assembly actually
// implements for them, and the card fades out once the first part is down.
if (window.matchMedia?.('(pointer: coarse)').matches && controlsLegend) {
  controlsLegend.innerHTML = `
    <div class="lg-title">조작</div>
    <div><b>끌어오기</b>로 부품을 가져오기 · 배치한 부품은 <b>끌어서 이동</b></div>
    <div><b>탭</b>으로 한 핀, 그 다음 대상 핀을 선택해 연결</div>
    <div><b>길게 누르기</b>로 부품 또는 전선 제거 · <b>더블 탭</b>으로 회전</div>`;
  window.addEventListener('bench:placed', () => {
    setTimeout(() => controlsLegend.classList.add('faded'), 1200);
  }, { once: true });
}

// ── share build ─────────────────────────────────────────────────
document.getElementById('share-btn').addEventListener('click', async () => {
  if (api.get_document().components.length === 0) { hud.flash('부품을 먼저 몇 개 놓은 다음 공유하세요', 'bad'); return; }
  const url = docSave.shareUrl();
  try {
    await navigator.clipboard.writeText(url);
    hud.flash('작품 공유 링크가 클립보드에 복사됐어요', 'ok');
  } catch {
    // clipboard blocked (insecure context / permissions) — fall back to a prompt
    window.prompt('공유할 작품 링크를 복사하세요:', url);
  }
  track(EVENTS.SHARE, { components: api.get_document().components.length });
});

// ── minimizable panels (tray + firmware): collapse to their header so the 3D
// workspace can take the whole screen (especially on phones) ──
for (const btn of document.querySelectorAll('.panel-min')) {
  btn.addEventListener('click', () => document.getElementById(btn.dataset.panel)?.classList.toggle('min'));
}
window.__lab = { assemblyApi, api, hud, hephaestus, audio };   // debug/testing hook
track(EVENTS.LOAD);   // funnel entry — app booted

// ── cloud account + sync ─────────────────────────────────────────
// Lesson/progress sync was removed in the pivot; only the build document
// (kind:'save') syncs now. profiles.tier is still read (Hephaestus quota later).
// The classroom shell stays dormant (teams/edu payer path).
const classroom = initClassroom();
const account = initAccount({
  onClassroom: () => classroom.open(),
  onSignOut: () => {},
  onSignIn: async () => {
    try {
      const prof = await getProfile();
      currentTier = (prof && prof.tier) || 'free';
      account.setTier(currentTier);   // Hephaestus quota lifts for pro
      // pull the build document (kind:'save'); load it if it's a v2 RobotDoc
      const rs = await pullDocument('save', 0);
      if (rs && rs.v === 2 && Array.isArray(rs.components)) api.loadDocument(rs);
      await flushQueue();
      hud.flash('계정에 동기화되었어요', 'ok');
    } catch { /* sync is best-effort */ }
  },
});

// ── onboarding overlay ──────────────────────────────────────────
function dismissOverlay() {
  document.getElementById('overlay')?.classList.add('hidden');
  try { localStorage.setItem('sbl-seen', '1'); } catch {}
}
document.getElementById('overlay-start')?.addEventListener('click', dismissOverlay);
document.getElementById('overlay-tour')?.addEventListener('click', () => {
  dismissOverlay();
  // second CTA opens the assistant — the fastest path past a blank bench
  document.getElementById('hephaestus')?.classList.remove('collapsed');
  document.getElementById('hephaestus-input')?.focus();
});

// ── upload / simulation ─────────────────────────────────────────
const uploadBtn = document.getElementById('upload-btn');
const uploadLabel = uploadBtn.querySelector('span');
uploadBtn.addEventListener('click', async () => {
  if (uploadBtn.disabled) return;

  uploadBtn.classList.add('loading');
  uploadLabel.textContent = 'STARTING…';
  await enterSim();   // loads Rapier + builds the doc-driven body
  uploadBtn.classList.remove('loading');
  uploadLabel.textContent = 'RUN';
});

// RUN: build the doc-driven motor body from the current document and spin it
// from the solved circuit. Async (Rapier WASM + build). `entering` coalesces
// concurrent callers onto the *same* promise rather than dropping the later ones
// on the floor — a dropped call is how `api.run_sim()` used to look like a
// silent no-op to a caller that then waited forever for ω to climb.
let entering = null;
function enterSim() {
  if (state.mode === 'sim') return Promise.resolve();
  if (!entering) entering = doEnterSim().finally(() => { entering = null; });
  return entering;
}
async function doEnterSim() {
  try {
    await loadRapier();
    window.__perf?.mark('rapier');
    await creatorSim.build(api.get_document());
  } catch (e) {
    hud.flash('시뮬레이션 시작에 실패했어요', 'bad');
    throw e;   // 호출자(및 오류 경계)에 노출되며 삼켜지지 않음
  }
  set('mode', 'sim');
  assemblyApi.group.visible = false;   // hides parts + wires (both live under the group)
  for (const d of assemblyDecor) d.visible = false;
  // the room (and its lights) is gone in RUN — bring the studio rig back or the
  // sim arena renders unlit
  for (const l of studioLights) l.visible = true;
  canvas.style.cursor = 'default';
  controlsLegend.classList.add('hidden');
  creatorSim.reset();
  creatorSim.start();
  // frame the wheels
  controls.enabled = false;
  camera.position.set(14, 12, 20);
  camera.lookAt(0, 6, 0);
  hud.simHud.classList.remove('hidden');
  hud.setStatus('움직이고 있어요! 회로가 진짜 물리 시뮬레이션을 구동합니다.');
  audio.startMotor();
  trackOnce(EVENTS.RUN_ENTER, { components: api.get_document().components.length });
}

function exitSim() {
  set('mode', 'assembly');
  audio.stopMotor();
  creatorSim.hide();
  assemblyApi.group.visible = true;
  for (const d of assemblyDecor) d.visible = true;
  for (const l of studioLights) l.visible = false;   // back to the room's own lighting
  canvas.style.cursor = 'crosshair';
  controlsLegend.classList.remove('hidden');
  controls.enabled = true;
  frameBench();
  hud.simHud.classList.add('hidden');
}

// Frame the bench, and keep that framing honest across aspect ratios.
//
// This is the one place the bench camera is composed, so exitSim(), boot and the
// phone-shell layout swap all land on the same shot. A perspective camera's
// *horizontal* field of view shrinks with the aspect ratio, so a viewport much
// narrower than it is tall crops the bench; past that point the camera backs off
// along the same view axis (and the dolly limit lifts with it, or OrbitControls
// would clamp the pull straight back out). The threshold is deliberately below
// a phone's portrait aspect — measured on a 390×618 canvas the stock shot still
// frames the whole bench, and pulling back there only made the parts small.
const BENCH_TARGET = { x: 4, y: 0, z: 2 };
const BENCH_EYE = { x: 34, y: 80, z: 93 };
const BENCH_BASE = Math.hypot(BENCH_EYE.x - BENCH_TARGET.x, BENCH_EYE.y - BENCH_TARGET.y, BENCH_EYE.z - BENCH_TARGET.z);
function frameBench() {
  const aspect = camera.aspect || 1;
  const pull = Math.min(1.35, Math.max(1, 0.55 / aspect));
  const dist = BENCH_BASE * pull;
  controls.target.set(BENCH_TARGET.x, BENCH_TARGET.y, BENCH_TARGET.z);
  camera.position.set(
    BENCH_TARGET.x + ((BENCH_EYE.x - BENCH_TARGET.x) / BENCH_BASE) * dist,
    BENCH_TARGET.y + ((BENCH_EYE.y - BENCH_TARGET.y) / BENCH_BASE) * dist,
    BENCH_TARGET.z + ((BENCH_EYE.z - BENCH_TARGET.z) / BENCH_BASE) * dist,
  );
  controls.maxDistance = Math.max(175, dist * 1.2);
  camera.fov = 55;
  camera.updateProjectionMatrix();
  camera.lookAt(controls.target.x, controls.target.y, controls.target.z);
  controls.update();
}

// ── render loop ─────────────────────────────────────────────────
let last = performance.now();
function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const dt = (now - last) / 1000;
  last = now;

  if (state.mode === 'assembly') {
    controls.update();
    floorUniforms.uTime.value += dt;
    assemblyApi.animate(dt);   // current-flow charges along wired nets
  }

  if (state.mode === 'sim') {
    creatorSim.step(dt);
    // motor hum tracks the fastest wheel's ω
    let wmax = 0;
    for (const m of creatorSim.motors) wmax = Math.max(wmax, Math.abs(creatorSim.omega(m.id)));
    audio.setMotor(wmax * 0.3);
    camera.lookAt(0, 6, 0);
  }

  composer.render();
}
animate();
resize();
frameBench();   // compose the bench for whatever aspect this device actually has

