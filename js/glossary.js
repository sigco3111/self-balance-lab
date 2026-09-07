// 모든 부품과 모든 핀에 대한 평이한 용어 사전.
// UI가 호버 시 "IN2가 뭐야?"를 설명할 수 있도록 키로 잡혀 있습니다.
//   COMPONENTS[compType]        -> { title, blurb, unit }
//   PINS[`${compType}.${pin}`]  -> { title, role, kind }   kind: power|ground|data
// `kind`는 툴팁 액센트 색을 결정하며 wiring.js 의미와 매칭됩니다.

export const COMPONENTS = {
  motor: {
    title: 'DC 모터',
    blurb: '전류를 회전으로 바꿉니다. 회전할수록 역기전력으로 다시 밀어내어 전류를 감소시키기 때문에, 멈춘 모터가 가장 많은 전류를 끌어다 씁니다.',
    unit: '모터',
  },
  resistor: {
    title: '저항',
    blurb: '흐를 수 있는 전류의 양을 제한합니다. 가장 흔한 용도는 LED와 직렬로 연결해 전지가 기꺼이 공급할 1A 대신 LED가 원하는 수 mA만 받게 하는 겁니다.',
    unit: '기초 부품',
  },
  switch: {
    title: '스위치',
    blurb: '회로를 끊거나 잇습니다. 열려 있으면 그 분기엔 전류가 흐르지 않습니다 — 회로가 동작하려면 전지로 돌아가는 닫힌 경로가 있어야 합니다.',
    unit: '기초 부품',
  },
  potentiometer: {
    title: '가변저항',
    blurb: '값을 돌릴 수 있는 저항. 노브를 스크롤해 저항을 바꾸면, 그에 따라 전류와 전류가 공급하는 모든 것이 함께 변합니다.',
    unit: '기초 부품',
  },
  led: {
    title: 'LED',
    blurb: '빛을 내는 다이오드. 한 방향으로만 통전하고 약 2V가 걸려야 켜지며, 대략 30mA를 넘으면 타버립니다 — 그래서 거의 항상 직렬 저항이 필요합니다.',
    unit: '기초 부품',
  },
  battery: {
    title: '7.4V 리튬 폴리머 (2셀)',
    blurb: '전원 공급원. 모터 드라이버와 아두이노의 VIN에 약 7.4V를 공급합니다. 회로의 모든 그라운드는 결국 여기로 돌아옵니다.',
    unit: '단원 1 · 전자 기초',
  },
  push_button: {
    title: '푸시 버튼',
    blurb: '누르고 있는 동안만 닫히는 모멘터리 스위치. 3D에서 버튼 본체를 클릭해 누를 수 있습니다.',
    unit: '단원 1 · 전자 기초',
  },
  lamp: {
    title: '백열 전구',
    blurb: '필라멘트 전구. 빛나는 저항이라 할 수 있습니다 — 흐르는 전류가 많을수록 더 밝게 빛납니다. 너무 많이 끌면 타버립니다.',
    unit: '단원 1 · 전자 기초',
  },
  buzzer: {
    title: '피에조 버저',
    blurb: '전류가 통과하면 음을 냅니다. + / − 극성이 있으므로 단자에 주의하세요.',
    unit: '단원 1 · 전자 기초',
  },
  diode: {
    title: '다이오드',
    blurb: '전류의 일방향 밸브: 약 0.7V를 넘으면 애노드(A)에서 캐소드(K)로 통전하고, 반대쪽은 차단합니다. 줄무늬가 캐소드를 표시합니다.',
    unit: '단원 1 · 전자 기초',
  },
  photoresistor: {
    title: '광저항 (LDR)',
    blurb: '빛 의존 저항. 빛이 강해질수록 저항이 떨어집니다. 인스펙터에서 저항을 편집해 빛의 세기를 모델링하세요.',
    unit: '단원 5 · 센서',
  },
  thermistor: {
    title: '서미스터',
    blurb: '온도 의존 저항. 열에 따라 저항이 변합니다 — 온도를 감지하는 가장 간단한 방법입니다. 인스펙터에서 저항을 조정해 보세요.',
    unit: '단원 5 · 센서',
  },
  fuse: {
    title: '퓨즈',
    blurb: '의도적으로 약한 연결. 부하가 정격을 넘으면 끊어져서 나머지 회로를 보호합니다.',
    unit: '단원 1 · 전자 기초',
  },
  capacitor: {
    title: '커패시터',
    blurb: '두 판에 전하를 저장합니다. 정상 직류에서는 (일단 충전되면) 거의 개방 회로처럼 동작합니다 — 그래서 이 DC 해석기에서는 거의 전류를 흘리지 않습니다.',
    unit: '단원 1 · 전자 기초',
  },
  servo: {
    title: '서보 모터',
    blurb: '타겟 각도를 지시하는 신호 라인(SIG)이 있는 기어 모터. + / −에서 전원을 공급받으며 회로 안에서는 작은 모터처럼 동작합니다.',
    unit: '단원 3 · 모터와 드라이버',
  },
  relay: {
    title: '릴레이',
    blurb: '전기적으로 제어되는 스위치. 여자되면 COM을 NO(통상 개방)에 연결해 작은 신호로 더 큰 부하를 스위치할 수 있습니다.',
    unit: '단원 3 · 모터와 드라이버',
  },
};

// 핀 역할. `kind`는 툴팁 액센트 색을 결정합니다.
export const PINS = {
  // ── 첫 회로에 항상 등장하는 부품들 ──
  'motor.A': { title: '모터 단자 A', role: '모터 코일의 한쪽 끝. 여기서 들어가 B로 나가는 전류가 모터를 한쪽 방향으로 회전시킵니다. 둘을 바꾸면 반대 방향으로 돕니다.', kind: 'power' },
  'motor.B': { title: '모터 단자 B', role: '코일의 다른 한쪽 — 전지로 돌아가는 귀환 경로입니다.', kind: 'power' },
  'resistor.A': { title: '저항 리드 A', role: '저항은 극성이 없습니다: 어느 리드든 공급 쪽을 향할 수 있습니다.', kind: 'power' },
  'resistor.B': { title: '저항 리드 B', role: '다른 리드. A와 같음 — 방향은 문제되지 않습니다.', kind: 'power' },
  'switch.A': { title: '스위치 단자 A', role: '접점의 한쪽. 닫혔을 때 A와 B가 연결되며, 열리면 회로가 끊어집니다.', kind: 'power' },
  'switch.B': { title: '스위치 단자 B', role: '접점의 다른 한쪽.', kind: 'power' },
  'potentiometer.A': { title: '가변저항 끝 A', role: '저항 트랙의 한쪽 끝. 노브가 회로에 얼마나 들어갈지를 결정합니다.', kind: 'power' },
  'potentiometer.B': { title: '가변저항 끝 B', role: '트랙의 다른 쪽 끝.', kind: 'power' },
  'led.A': { title: '애노드 (+)', role: '양의 다리 — 이 쪽이 전지의 + 단자를 향해야 LED가 켜집니다.', kind: 'power' },
  'led.K': { title: '캐소드 (−)', role: '음의 다리, 전지의 − 단자 쪽으로 돌아갑니다. 반대로 연결하면 아예 전류가 흐르지 않습니다.', kind: 'ground' },



  // ── 모터 ──

  // ── 건전지 ──
  'battery.+': { title: '양 단자 (+7.4V)', role: '모터 드라이버의 12V 입력과 아두이노의 VIN에 전원을 공급합니다.', kind: 'power' },
  'battery.-': { title: '음 단자 (0V)', role: '회로의 그라운드 기준 — 모든 것이 결국 여기로 돌아옵니다.', kind: 'ground' },

  // ── 새로운 작업대 부품 ──
  'push_button.A': { title: '버튼 단자 A', role: '모멘터리 접점의 한쪽. 누르고 있는 동안만 닫힙니다.', kind: 'data' },
  'push_button.B': { title: '버튼 단자 B', role: '모멘터리 접점의 다른 한쪽.', kind: 'data' },
  'lamp.A': { title: '전구 단자', role: '필라멘트의 한쪽 끝. 전류가 흐르면 전구가 빛납니다.', kind: 'power' },
  'lamp.B': { title: '전구 단자', role: '필라멘트의 다른 끝, 귀환 경로.', kind: 'power' },
  'buzzer.+': { title: '버저 + 단자', role: '버저로 들어가는 양의 공급.', kind: 'power' },
  'buzzer.-': { title: '버저 − 단자', role: '그라운드로의 귀환.', kind: 'ground' },
  'diode.A': { title: '애노드 (A)', role: '전류가 들어오는 곳. ~0.7V를 넘으면 캐소드 쪽으로 통전합니다.', kind: 'power' },
  'diode.K': { title: '캐소드 (K)', role: '전류가 나가는 곳 (줄무늬로 표시). 반대 방향은 차단합니다.', kind: 'power' },
  'photoresistor.A': { title: 'LDR 단자 A', role: '광 의존 저항의 한쪽.', kind: 'data' },
  'photoresistor.B': { title: 'LDR 단자 B', role: '광 의존 저항의 다른 한쪽.', kind: 'data' },
  'thermistor.A': { title: '서미스터 단자 A', role: '온도 의존 저항의 한쪽.', kind: 'data' },
  'thermistor.B': { title: '서미스터 단자 B', role: '온도 의존 저항의 다른 한쪽.', kind: 'data' },
  'fuse.A': { title: '퓨즈 단자 A', role: '전류가 들어오는 곳. 정격을 넘기 전까지는 자유롭게 흐릅니다.', kind: 'data' },
  'fuse.B': { title: '퓨즈 단자 B', role: '보호받는 회로 쪽으로 나가는 곳.', kind: 'data' },
  'capacitor.A': { title: '커패시터 + 판', role: '양의 판. 충전 후에는 정상 직류를 차단합니다.', kind: 'power' },
  'capacitor.B': { title: '커패시터 − 판', role: '음의 판.', kind: 'power' },
  'servo.+': { title: '서보 + (전원)', role: '서보 모터로의 모터 공급.', kind: 'power' },
  'servo.-': { title: '서보 − (그라운드)', role: '그라운드로의 귀환.', kind: 'ground' },
  'servo.SIG': { title: '서보 신호 (SIG)', role: '타겟 각도를 지시하는 제어 라인.', kind: 'data' },
  'relay.COM': { title: '릴레이 COM (공통)', role: '릴레이가 여자되면 NO로 전환되는 공통 극.', kind: 'data' },
  'relay.NO': { title: '릴레이 NO (통상 개방)', role: '릴레이가 켜져 있는 동안에만 COM과 연결됩니다.', kind: 'data' },
};

// rover는 인스턴스 네임스페이스 하에서 기본 부품을 재사용합니다 (두 드라이버
// l298nF/l298nR, 네 개의 모터 motorFL/FR/RL/RR). 인스턴스화된 compType을
// 다시 그 기본 항목으로 매핑해 핀/툴팁이 데이터를 중복 정의하지 않고도 해석되게 합니다.
function baseType(t) {
  if (t === 'l298nF' || t === 'l298nR') return 'l298n';
  if (t === 'motorFL' || t === 'motorRL') return 'motorL';
  if (t === 'motorFR' || t === 'motorRR') return 'motorR';
  return t;
}

// "compType.pin" id를 기본 부품으로 다시 키잉합니다 (예: l298nF.IN1 → l298n.IN1).
function baseId(id) {
  const dot = id.indexOf('.');
  if (dot < 0) return id;
  return baseType(id.slice(0, dot)) + id.slice(dot);
}

export function pinInfo(id) { return PINS[id] || PINS[baseId(id)] || null; }
export function compInfo(type) { return COMPONENTS[type] || COMPONENTS[baseType(type)] || null; }
