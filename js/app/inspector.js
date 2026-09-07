// 인스펙터 패널 — 살아 있는 RobotDoc을 들여다보는 DOM 창. 보유한 것은 아무것도 그리지 않습니다:
// 모든 값은 `window.__api`(get_document / read_electrical / read_telemetry)에서 옵니다.
// 테스트와 (이후) 헤파이스토스가 구동하는 바로 그 표면입니다. 이전의 가이드 레일을 대체하는
// M1 항목입니다 — 가이드를 삭제하면서 화면의 자리가 없었던 전기 해석과 위반을 가져옵니다.
//
// 인스펙터가 직접 수행하는 유일한 변경은 인라인 파라미터 편집이며, 그것조차도
// `api.set_param`을 거칩니다 — 어떤 변경 로직도 여기에 살지 않습니다.

const fmt = (n, d = 2) => (Number.isFinite(n) ? n.toFixed(d) : '—');

// 적응형 전류 표시: 1A 미만일 때는 mA 단위로(LED가 깔끔히 읽히도록), 1A 이상은 A 단위로.
function fmtCurrent(i) {
  if (!Number.isFinite(i)) return { value: '—', unit: '' };
  const a = Math.abs(i);
  if (a < 1) return { value: fmt(a * 1000, a < 0.01 ? 1 : 0), unit: 'mA' };
  return { value: fmt(a, 2), unit: 'A' };
}

// 부품 타입의 친근한 표시 이름 (카드가 읽기 쉽도록 함). 나열되지 않은 것은
// Title-cased 타입으로 대체되어, 새 부품도 깔끔하게 보입니다.
const TYPE_LABEL = {
  battery: '건전지', motor: '모터', resistor: '저항', switch: '스위치',
  potentiometer: '가변저항', led: 'LED', push_button: '푸시 버튼',
  lamp: '전구', buzzer: '버저', diode: '다이오드', photoresistor: '광저항',
  thermistor: '서미스터', fuse: '퓨즈', capacitor: '커패시터', servo: '서보',
  relay: '릴레이',
};
function typeLabel(t) {
  if (TYPE_LABEL[t]) return TYPE_LABEL[t];
  const base = String(t || '').replace(/[_-]+/g, ' ');
  return base.replace(/\b\w/g, (c) => c.toUpperCase());
}

// 인스펙터에 노출할 가치가 있는 파라미터의 사람이 읽는 라벨과 step. 나열되지 않은
// 파라미터는 숨겨진 채로 남습니다 (사용자가 만지면 안 되는 내부값). 새 부품 타입은
// 가능한 한 이 라벨을 재사용; 알려지지 않은 파라미터는 paramsHtml()의 PARAM_META
// 조회를 통해 우아하게 버려집니다.
const PARAM_META = {
  // 표준 (현재 라이브러리)
  voltsNominal: { label: '전압', step: 0.1, unit: 'V' },
  internalResistance: { label: '내부 R', step: 0.1, unit: 'Ω' },
  resistance: { label: 'R', step: 1, unit: 'Ω' },
  maxResistance: { label: '최대 R', step: 10, unit: 'Ω' },   // 레오스타트 / 포텐셔미터 노브 범위
  forwardVoltage: { label: 'Vꜰ', step: 0.1, unit: 'V' },
  ke: { label: 'Kᴇ', step: 0.01, unit: '' },
  friction: { label: '마찰', step: 0.001, unit: '' },
  maxCurrent: { label: 'I 최대', step: 1, unit: 'A' },
  closed: { label: '닫힘', bool: true },
  // 새 부품이 쓸 수 있는 짧은 별칭 (가드: 있을 때만 렌더)
  volts: { label: '전압', step: 0.1, unit: 'V' },
  vf: { label: 'Vꜰ', step: 0.1, unit: 'V' },
  imax: { label: 'I 최대', step: 1, unit: 'A' },
  // 들어오는 새 부품의 새 스칼라
  capacitanceUf: { label: 'C', step: 1, unit: 'µF' },    // 커패시터 (라이브러리 파라미터 ID와 매치)
  angle: { label: '각도', step: 1, unit: '°' },          // 서보
  light: { label: '빛', step: 1, unit: '%' },          // 광저항 노출
  temperature: { label: '온도', step: 1, unit: '°C' },    // 서미스터
};

export function initInspector(api, { getMode } = {}) {
  const host = document.getElementById('inspector');
  if (!host) return { refresh() {} };

  // 사용자가 활발히 편집 중인 필드는 덮어쓰지 않습니다 (그대로 두면 400ms 폴이
  // 키 입력 도중에 innerHTML을 갱신해 포커스를 떨어뜨립니다).
  function isEditing() {
    const a = document.activeElement;
    return a && host.contains(a) && (a.tagName === 'INPUT' || a.tagName === 'SELECT');
  }

  function render() {
    if (isEditing()) return;
    const doc = api.get_document();
    const comps = doc.components || [];
    const nets = doc.nets || [];
    const elec = safe(() => api.read_electrical(), { current: {}, violations: [], ok: true });
    const running = getMode ? getMode() === 'sim' : false;

    if (comps.length === 0) {
      host.innerHTML = `<div class="insp-empty"><i data-lucide="cable"></i><b>아직 연결된 것이 없어요</b><p>두 부품을 놓고 핀을 연결하면 전기가 어떻게 흐르는지 보입니다.</p></div>`;
      try { window.lucide?.createIcons(); } catch { /* 아이콘은 부가 기능 */ }
      return;
    }

    const tel = running ? safe(() => api.read_telemetry(), {}) : null;

    host.innerHTML = [
      violationsHtml(elec),
      componentsHtml(comps, elec, tel),
      netsHtml(nets),
    ].join('');
  }

  function componentsHtml(comps, elec, tel) {
    const rows = comps.map((c) => {
      const i = elec.current?.[c.id];
      const cur = fmtCurrent(i);
      const live = Number.isFinite(i) && Math.abs(i) > 1e-4;
      const dir = live ? `<span class="insp-dir">${i >= 0 ? '▲' : '▼'}</span>` : '';
      const ampsReading = Number.isFinite(i)
        ? `<span class="insp-amps ${live ? 'is-live' : ''}" title="${esc(c.id)}를 흐르는 전류">
             ${dir}<b>${cur.value}</b><i class="insp-unit">${cur.unit}</i>
           </span>`
        : `<span class="insp-amps insp-idle" title="전류 없음">—</span>`;
      // 시뮬레이션이 라이브일 때 이 모터의 ω 보고
      const w = tel?.omega?.[c.id];
      const speed = Number.isFinite(w)
        ? `<span class="insp-omega" title="축 속도">${fmt(w, 1)}<i class="insp-unit">rad/s</i></span>`
        : '';
      return `<div class="insp-comp" data-type="${esc(c.type)}">
        <div class="insp-comp-head">
          <span class="insp-id">${esc(c.id)}</span>
          <span class="insp-type">${esc(typeLabel(c.type))}</span>
        </div>
        <div class="insp-readings">${ampsReading}${speed}</div>
        ${paramsHtml(c)}
      </div>`;
    }).join('');
    return `<div class="insp-sect"><div class="insp-h">내 부품 <span class="insp-count">${comps.length}</span></div>${rows}</div>`;
  }

  // 한 부품의 편집 가능한 파라미터 행 — PARAM_META에서 나온 튜닝 노브.
  // PARAM_META 항목이 없는 파라미터는 조용히 건너뜁니다 (알려지지 않은 파라미터 가드).
  function paramsHtml(c) {
    const params = c.params || {};
    const keys = Object.keys(params).filter(k => PARAM_META[k]);
    if (keys.length === 0) return '';
    const fields = keys.map((k) => {
      const meta = PARAM_META[k];
      const v = params[k];
      if (meta.bool) {
        return `<label class="insp-pfield insp-pbool">
          <input type="checkbox" data-comp="${esc(c.id)}" data-key="${esc(k)}" ${v ? 'checked' : ''}>
          <span>${esc(meta.label)}</span>
        </label>`;
      }
      return `<label class="insp-pfield">
        <span class="insp-plabel">${esc(meta.label)}</span>
        <input type="number" step="${meta.step}" value="${Number.isFinite(v) ? v : ''}"
          data-comp="${esc(c.id)}" data-key="${esc(k)}">
        ${meta.unit ? `<i class="insp-unit">${esc(meta.unit)}</i>` : ''}
      </label>`;
    }).join('');
    return `<div class="insp-params">${fields}</div>`;
  }

  function netsHtml(nets) {
    if (nets.length === 0) {
      return `<div class="insp-sect"><div class="insp-h">전선</div><p class="hint">두 핀을 연결해 첫 번째 경로를 만드세요.</p></div>`;
    }
    const rows = nets.map((n) => `<div class="insp-net">
      <span class="insp-swatch" style="background:${esc(n.color || '#888')}"></span>
      <span class="insp-eps">${n.endpoints.map(esc).join(' · ')}</span>
    </div>`).join('');
    return `<div class="insp-sect"><div class="insp-h">전선 <span class="insp-count">${nets.length}</span></div>${rows}</div>`;
  }

  // 각 위반 코드에 대한 평이한 안내 — "왜 + 어떻게".
  function hintFor(v) {
    switch (v.code) {
      case 'short':
        return '두 단자가 같은 전선 위에 있어 전류가 제한 없이 곧장 흘러갑니다. + 와 − 사이에 부하(저항, 모터 또는 LED)를 두세요.';
      case 'over-current':
        return '이 부품이 견딜 수 있는 것보다 더 많은 전류가 흐르고 있습니다. 직렬로 저항을 추가하거나 공급 전압을 낮춰 보세요.';
      case 'floating-pin':
        return '이 핀이 아직 어디에도 연결되지 않았습니다. 회로를 완성하려면 전선에 연결하세요.';
      default:
        return '';
    }
  }

  function violationsHtml(elec) {
    const vs = elec.violations || [];
    if (vs.length === 0) {
      return `<div class="insp-sect"><div class="insp-ok"><span class="insp-ok-mark">✓</span><span><b>좋아요</b><small>회로 정상 — 안전 문제 없음.</small></span></div></div>`;
    }
    const errN = vs.filter(v => (v.level || 'warn') === 'error').length;
    const summary = errN
      ? `해결할 문제 ${errN}개`
      : `확인할 부분 ${vs.length}개`;
    const rows = vs.map((v) => {
      const level = esc(v.level || 'warn');
      const hint = hintFor(v);
      return `<div class="insp-viol insp-${level}">
        <div class="insp-viol-head">
          <span class="insp-viol-tag">${esc((v.code || 'issue').replace(/[_-]+/g, ' ').toUpperCase())}</span>
          ${v.ref ? `<span class="insp-ref">${esc(v.ref)}</span>` : ''}
        </div>
        <div class="insp-viol-msg">${esc(v.message || '')}</div>
        ${hint ? `<div class="insp-viol-hint">${esc(hint)}</div>` : ''}
      </div>`;
    }).join('');
    return `<div class="insp-sect insp-issues">
      <div class="insp-h insp-h-alert">${esc(summary)}</div>${rows}
    </div>`;
  }

  // 라이브 파라미터 편집 → api.set_param. 위임되어 재렌더링에서도 살아남음.
  function onEdit(e) {
    const el = e.target;
    if (!el.dataset || !el.dataset.comp) return;
    const id = el.dataset.comp, key = el.dataset.key;
    let value;
    if (el.type === 'checkbox') value = el.checked;
    else {
      value = parseFloat(el.value);
      if (!Number.isFinite(value)) return;
    }
    api.set_param({ id, key, value });
    if (el.type === 'checkbox') render();   // 블러 없이; 스위치 상태를 즉시 갱신
  }
  host.addEventListener('change', onEdit);

  // 폴: 문서는 여러 곳에서 (드래그/드롭, 배선, 실행 취소, 스크립트) API를 통해 변경되며
  // 해석은 매 시뮬레이션 프레임마다 바뀝니다 — 가벼운 폴은 모든 변경 경로가 호출하지 않고도
  // 패널을 정직하게 유지합니다.
  render();
  const timer = setInterval(render, 400);

  return { refresh: render, stop: () => clearInterval(timer) };
}

function safe(fn, fallback) { try { return fn() ?? fallback; } catch { return fallback; } }
function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
