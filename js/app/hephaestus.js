// 헤파이스토스 — 클라이언트 에이전트 루프 (Milestone 2), Gemini API 기반.
//
// 대화(Gemini `contents`)와 도구 실행 루프를 소유; 모델의 결정은 오직 window.__api를 통해
// (runTool을 통해) 빌드에 도달합니다. 사용자 메시지당 흐름:
//   1. POST { contents, document } → /api/hephaestus  (모델 턴 한 번)
//   2. 응답에 functionCall 파트가 있으면: 각각을 api에 대해 실행하고 결과를 user 턴의
//      functionResponse 파트로 첨부한 뒤 1로 돌아감
//   3. 그렇지 않으면 모델 텍스트를 보여 주고 중단
//
// 무료 티어 QUOTA 게이트는 서명하지 않은 / 무료 사용자가 하루에 보낼 수 있는 메시지 수를 제한해,
// 공유되는 Gemini 무료 키가 소진되지 않도록 합니다. 프로 사용자(profiles.tier)는 제한 없음.
// 게이트는 클라이언트 측(localStorage)이며 — 무료 키를 보호하기에 충분; 서버 측 강제는 실제 인증
// 도입 시 함께 옵니다.
import { runTool } from '../api/tools.js';
import { track, EVENTS } from './analytics.js';

const ENDPOINT = '/api/hephaestus';
const MAX_STEPS = 8;          // 사용자 메시지당 모델 턴 수 (도구 루프)
const FREE_DAILY = 25;        // 브라우저당 하루 무료/익명 메시지
const USAGE_KEY = 'sbl-hephaestus-usage';

// 정적 호스팅(GitHub Pages, 일반 S3 등)과 Edge Function 호스팅(Vercel)을 자동으로 구분.
// Pages는 정적 파일만 제공하므로 `/api/hephaestus`는 404를 반환하고 호출은 405로 거절됨.
// 클라이언트가 헤드 요청을 보내 응답 코드로 호스팅 종류를 판단:
//   * 404 → 정적 호스팅(Pages) → 어시스턴트 비활성 안내
//   * 그 외(200/405/503 등) → Edge Function 호스팅 → 정상 시도
// `assets/api-status.json` 마커도 함께 가져와(있으면 명시적 플래그 사용) 호스트 측 판단 우선.
const probeApiAvailability = async () => {
  try {
    const meta = await fetch('./assets/api-status.json', { cache: 'no-cache' });
    if (meta.ok) {
      const j = await meta.json().catch(() => null);
      if (j && typeof j.hephaestus === 'boolean') {
        return { available: j.hephaestus, reason: j.reason || '' };
      }
    }
  } catch { /* 마커가 없거나 CORS로 막힘 — 헤드 요청으로 폴백 */ }
  try {
    const res = await fetch(ENDPOINT, { method: 'HEAD', cache: 'no-cache' });
    // Vercel Edge 함수는 OPTIONS/GET 없는 HEAD에 405를 줄 수 있지만 404는 Pages의 시그니처.
    // 404라면 정적 호스팅이라고 보고 비활성; 405 이상이면 Edge가 살아 있다고 보고 활성 시도.
    return {
      available: res.status !== 404,
      reason: res.status === 404 ? 'static-host' : `edge-${res.status}`,
    };
  } catch {
    return { available: false, reason: 'network-error' };
  }
};

// 한 번 누르면 시작 — 헤파이스토스가 전체를 만들 수 있음을 예시로 보여 주는
// 몇 가지 시작 프롬프트입니다 — 빈 작업대를 가장 빠르게 지나가는 길.
const EXAMPLE_PROMPTS = [
  '깜빡이는 LED 만들어 줘',
  '건전지를 모터에 연결해 줘',
  '모터를 켜고 끄는 스위치를 추가해 줘',
  '다 연결하고 실행해 줘',
];

export async function initHephaestus({ api, onFlash, getTier, onUpgrade } = {}) {
  const form = document.getElementById('hephaestus-form');
  const input = document.getElementById('hephaestus-input');
  const log = document.getElementById('hephaestus-log');
  if (!form || !input || !log) return { send: async () => {} };

  const contents = [];   // Gemini 메시지 이력 (사용자/모델 턴)
  let busy = false;

  // 비활성 모드(정적 호스팅)인 동안 입력과 폼을 막고 안내 메시지를 보여 줌.
  // 사용자가 메시지를 보내도 네트워크 호출이 일어나지 않아 405가 뜨지 않는다.
  const availability = await probeApiAvailability();
  if (!availability.available) {
    input.disabled = true;
    input.placeholder = '이 배포판에서는 어시스턴트를 사용할 수 없어요';
    form.querySelector('button[type="submit"]')?.setAttribute('disabled', 'disabled');
    log.innerHTML = '';
    const note = document.createElement('div');
    note.className = 'hp-msg hp-bot hp-disabled-note';
    const reason = availability.reason === 'static-host'
      ? 'GitHub Pages는 정적 호스팅이라 Vercel Edge Function을 실행할 수 없습니다. 어시스턴트는 Vercel 배포판에서만 동작해요.'
      : `헤파이스토스 백엔드에 연결할 수 없어요 (${availability.reason}). 잠시 후 다시 시도해 보세요.`;
    note.textContent = reason;
    log.appendChild(note);
    const link = document.createElement('div');
    link.className = 'hp-msg hp-bot hp-disabled-link';
    link.innerHTML = '원본 배포판(Vercel)에서는 어시스턴트가 정상 동작합니다 — <a href="https://selfbalance-lab.vercel.app/" target="_blank" rel="noopener">selfbalance-lab.vercel.app</a>에서 사용해 보세요.';
    log.appendChild(link);
    try { input.form?.addEventListener('submit', (e) => e.preventDefault()); } catch {}
    // 비활성 모드에서 호출되는 send는 항상 false; 네트워크 요청 없음.
    return {
      send: async () => {
        return { ok: false, disabled: true };
      },
    };
  }

  function bubble(who, text) {
    const el = document.createElement('div');
    el.className = `hp-msg hp-${who}`;
    el.textContent = text;
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }
  function toolNote(name, args) {
    const el = document.createElement('div');
    el.className = 'hp-tool';
    const a = Object.entries(args || {}).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(' ');
    el.textContent = `⚙ ${name}(${a})`;
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
  }

  // 모델 턴이 진행 중일 때 보이는 애니메이션 "생각 중…" 자리표시.
  // 반환된 핸들은 턴이 해결되자마자 제거됨.
  function showThinking() {
    const el = document.createElement('div');
    el.className = 'hp-thinking';
    el.setAttribute('aria-label', '헤파이스토스가 생각 중');
    el.innerHTML = '<span class="hp-dot"></span><span class="hp-dot"></span><span class="hp-dot"></span>';
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return { remove() { el.remove(); } };
  }

  // 예시 프롬프트 칩: 한 번 누르면 입력을 채우고 보냄. 한 번 렌더되고, 첫 사용자 메시지
  // 이후에는 숨겨져 대화를 어수선하게 만들지 않습니다.
  function renderChips() {
    const wrap = document.createElement('div');
    wrap.className = 'hp-chips';
    for (const p of EXAMPLE_PROMPTS) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'hp-chip';
      chip.textContent = p;
      chip.addEventListener('click', () => { send(p); });
      wrap.appendChild(chip);
    }
    log.appendChild(wrap);
    return wrap;
  }
  const chips = renderChips();

  // ── 무료 티어 쿼터 ──────────────────────────────────────────────
  function today() { return new Date().toISOString().slice(0, 10); }
  function usage() {
    try {
      const u = JSON.parse(localStorage.getItem(USAGE_KEY) || 'null');
      if (u && u.date === today()) return u;
    } catch {}
    return { date: today(), count: 0 };
  }
  function bumpUsage() {
    const u = usage(); u.count += 1;
    try { localStorage.setItem(USAGE_KEY, JSON.stringify(u)); } catch {}
  }
  function overQuota() {
    const tier = (getTier && getTier()) || 'free';
    if (tier !== 'free') return false;      // 프로/유료: 제한 없음
    return usage().count >= FREE_DAILY;
  }

  async function turn() {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ contents, document: api.get_document() }),
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      // 503 = Edge 프록시에 GEMINI_API_KEY가 설정되지 않음 (예: 로컬 개발 또는 fork).
      // 헤파이스토스는 선택 — 앱 전체가 그것 없이도 동작 — 그래서 망가진 듯 보이지 말고
      // 평이하게 말하세요.
      if (res.status === 503) {
        const err = new Error('이곳에선 헤파이스토스가 오프라인이에요 — API 키가 설정되지 않았습니다. 그래도 직접 만들 수 있습니다: 부품을 끌어다 놓고 핀끼리 클릭해 배선하세요.');
        err.soft = true;
        throw err;
      }
      if (res.status === 429) throw new Error('지금은 헤파이스토스가 바빠요 — 몇 초만 기다렸다가 다시 시도해 주세요.');
      throw new Error(e.error || `헤파이스토스 요청 실패 (${res.status})`);
    }
    return res.json();   // { content:{role,parts}, finishReason }
  }

  async function send(text) {
    if (busy || !text.trim()) return;
    if (overQuota()) {
      bubble('err', `오늘의 무료 한도를 모두 사용했어요 — 오늘 ${FREE_DAILY}개의 헤파이스토스 메시지를 모두 썼습니다. 로그인하거나 업그레이드해 더 받거나, 직접 만들 수도 있어요. 어차피 다 당신 거예요.`);
      onUpgrade?.();
      return;
    }
    busy = true;
    input.disabled = true;
    chips?.remove();   // 시작 칩은 역할을 다했음
    bubble('user', text);
    contents.push({ role: 'user', parts: [{ text }] });
    bumpUsage();   // 사용자 메시지 1개 = 단위 1개, 도구 왕복 횟수와 무관
    // 퍼널: 얼마나 많은 사용자가 실제로 어시스턴트를 찾는가, 그리고 그것을 쓰는 것이
    // 동작하는 회로를 만들 확률을 바꾸는가? (그 베팅을 정당화하는 분할)
    track(EVENTS.HEPHAESTUS_MSG, { turn: contents.length });

    try {
      for (let step = 0; step < MAX_STEPS; step++) {
        const thinking = showThinking();
        let reply;
        try { reply = await turn(); } finally { thinking.remove(); }
        const parts = (reply.content && reply.content.parts) || [];
        contents.push(reply.content || { role: 'model', parts: [] });

        for (const p of parts) {
          if (p.text && p.text.trim()) bubble('bot', p.text.trim());
        }

        const calls = parts.filter(p => p.functionCall);
        if (calls.length === 0) break;   // 모델이 완료됨

        const responseParts = [];
        for (const p of calls) {
          const { name, args } = p.functionCall;
          toolNote(name, args);
          // 일부 도구(run_sim)는 비동기 — 약속이 모델의 함수 응답에 `{}` 로 문자열화되어
          // 들어가지 않도록 무조건 await.
          const result = await runTool(api, name, args || {});
          track(EVENTS.HEPHAESTUS_TOOL, { tool: name, ok: !!result?.ok });
          responseParts.push({ functionResponse: { name, response: wrap(result) } });
        }
        contents.push({ role: 'user', parts: responseParts });
      }
    } catch (e) {
      const msg = e.message || '헤파이스토스 실패';
      bubble('err', msg);
      // 부드러운 실패(헤파이스토스가 단지 사용 불가)는 놀라운 빨간 상태 플래시를
      // 띄우지 않아야 합니다 — 앱은 멀쩡하고 어시스턴트만 꺼져 있어요.
      if (!e.soft) onFlash?.(msg, 'bad');
    } finally {
      busy = false;
      input.disabled = false;
      input.focus();
    }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value;
    input.value = '';
    send(text);
  });

  return { send };
}

// Gemini는 functionResponse.response가 JSON 객체(배열/스칼라 아님)일 것을 요구합니다 — 그 외는
// 모두 감싸 루프가 형식에 맞지 않는 파트를 보내지 않도록 합니다.
function wrap(result) {
  return (result && typeof result === 'object' && !Array.isArray(result)) ? result : { result };
}
