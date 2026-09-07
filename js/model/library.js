// 부품 라이브러리 — 순수한 메타데이터 (THREE 없음). 부품 타입별 핀, 기본 전기 파라미터,
// 핀 역할을 아는 단 하나의 위치입니다. parts.js(기하학)와 circuit.js(물리)는 모두 이를 따르므로
// 헤파이스토스가 추가한 부품과 사용자가 손으로 놓은 부품이 똑같이 묘사됩니다.
//
// 핀 역할: 'power+' | 'power-' | 'signal' | 'gnd'

export const LIBRARY = {
  battery: {
    label: '7.4V 리튬 폴리머',
    pins: [
      { name: '+', role: 'power+' },
      { name: '-', role: 'power-' },
    ],
    params: { voltsNominal: 7.4, capacityMah: 800, internalResistance: 0.4, maxCurrent: 30 },
  },
  motor: {
    label: 'DC 기어 모터',
    pins: [
      { name: 'A', role: 'power+' },
      { name: 'B', role: 'power-' },
    ],
    // resistance = 전기자 저항 R_a (Ω); ke = 역기전력/토크 상수 (V·s/rad).
    params: { resistance: 2.0, ke: 0.05, friction: 0.002, maxCurrent: 10 },
  },
  resistor: {
    label: '저항',
    // 수동 + 무극성: 어느 핀이든 A 또는 B가 될 수 있음.
    pins: [
      { name: 'A', role: 'signal' },
      { name: 'B', role: 'signal' },
    ],
    params: { resistance: 100, maxCurrent: 5 },
  },
  switch: {
    label: '스위치',
    pins: [
      { name: 'A', role: 'signal' },
      { name: 'B', role: 'signal' },
    ],
    // closed = 통전; open = 회로를 끊음. 시뮬레이션 안에서 토글.
    params: { closed: false, maxCurrent: 30 },
  },
  potentiometer: {
    label: '가변저항',
    // 2단자 가변 저항(레오스타트): 노브가 ~0부터 maxResistance 사이에서 저항을 설정.
    // 내리면 더 많은 전류가 흐름.
    pins: [
      { name: 'A', role: 'signal' },
      { name: 'B', role: 'signal' },
    ],
    params: { resistance: 500, maxResistance: 1000, maxCurrent: 5 },
  },
  led: {
    label: 'LED',
    // 극성: 애노드(A, 긴 다리) → 캐소드(K). A가 양극일 때만 점등.
    pins: [
      { name: 'A', role: 'power+' },
      { name: 'K', role: 'power-' },
    ],
    // forwardVoltage = Vf 강하; resistance = Ron; maxCurrent = 소실 한계 전류.
    params: { forwardVoltage: 2.0, resistance: 12, maxCurrent: 0.03 },
  },
  push_button: {
    label: '푸시 버튼',
    // 모멘터리 스위치: 평소엔 열려 있고 누르고 있는 동안만 통전.
    pins: [
      { name: 'A', role: 'signal' },
      { name: 'B', role: 'signal' },
    ],
    description: '누르고 있는 동안만 통전하는 모멘터리 푸시 버튼. 놓으면 다시 열립니다.',
    params: { closed: false, maxCurrent: 5 },
  },
  lamp: {
    label: '전구',
    // 백열전구: 평범한 저항성 부하. 밝기는 해석된 전류에 따라 결정됨 (LED와 비슷하지만 무극성, 옴성).
    pins: [
      { name: 'A', role: 'power+' },
      { name: 'B', role: 'power-' },
    ],
    description: '저항성 부하인 백열 전구. 흐르는 전류가 많을수록 더 밝게 빛납니다.',
    params: { resistance: 24, maxCurrent: 0.5 },
  },
  buzzer: {
    label: '버저',
    // 피에조/전자기 버저: 저항성 부하로 모델링. 전류가 흐를 때 소리를 냄. 작은 스피커 코일처럼 극성이 있음.
    pins: [
      { name: '+', role: 'power+' },
      { name: '-', role: 'power-' },
    ],
    description: '액티브 버저. 전류가 흐르는 동안 소리를 내는 저항성 부하입니다.',
    params: { resistance: 80, maxCurrent: 0.1 },
  },
  diode: {
    label: '다이오드',
    // 극성 정류기: 애노드(A) → 캐소드(K) 방향의 전압 강하를 넘으면 통전하고, 반대쪽은 차단.
    // LED와 같은 파이시스-리니어 모델.
    pins: [
      { name: 'A', role: 'power+' },
      { name: 'K', role: 'power-' },
    ],
    description: '정류 다이오드 — 순방향 강하 전압을 넘으면 A→K 방향으로만 전류를 흘리고, 반대쪽은 차단합니다.',
    params: { forwardVoltage: 0.7, resistance: 5, maxCurrent: 1 },
  },
  photoresistor: {
    label: '광저항',
    // 광 의존 저항(LDR): 가변 저항(포텐셔미터처럼). 저항은 빛의 세기를 대신함 (밝을수록 R 낮음).
    pins: [
      { name: 'A', role: 'signal' },
      { name: 'B', role: 'signal' },
    ],
    description: '광 의존 저항(LDR) — 빛이 강해질수록 저항이 떨어집니다.',
    params: { resistance: 5000, maxResistance: 200000, maxCurrent: 1 },
  },
  thermistor: {
    label: '서미스터',
    // 온도 의존 저항: 가변 저항(포텐셔미터처럼). 저항은 센싱한 온도를 대신함.
    pins: [
      { name: 'A', role: 'signal' },
      { name: 'B', role: 'signal' },
    ],
    description: '온도 의존 저항 — 온도에 따라 저항이 변합니다.',
    params: { resistance: 10000, maxResistance: 100000, maxCurrent: 1 },
  },
  fuse: {
    label: '퓨즈',
    // 거의 이상적인 도선. maxCurrent(정격 차단 전류)를 넘으면 과전류 위반을 표시.
    // 무극성.
    pins: [
      { name: 'A', role: 'signal' },
      { name: 'B', role: 'signal' },
    ],
    description: '보호용 퓨즈 — 거의 이상적인 도체로, 정격을 넘는 전류가 흐르면 과전류를 표시합니다.',
    params: { resistance: 0.01, maxCurrent: 1 },
  },
  capacitor: {
    label: '커패시터',
    // 직류 정상 상태에서 커패시터는 개방 회로(전류 차단). 해가 잘 정의되도록 매우 높은 저항으로 모델링.
    // 여기서는 무극성.
    pins: [
      { name: 'A', role: 'power+' },
      { name: 'B', role: 'power-' },
    ],
    description: '커패시터 — 전하를 저장하고 정상 직류를 차단하여, 평형 상태에서는 개방 회로처럼 동작합니다.',
    params: { capacitanceUf: 100, maxCurrent: 5 },
  },
  servo: {
    label: '서보 모터',
    // DC 모터 전기 모델(역기전력 + 전기자 저항이 있는 V 소스)을 공유. 세 번째 핀은 (여기서는
    // 비전원) 제어 신호 라인.
    pins: [
      { name: '+', role: 'power+' },
      { name: '-', role: 'power-' },
      { name: 'SIG', role: 'signal' },
    ],
    description: '호비 서보 모터 — DC 모터처럼 구동되며, 별도의 제어 신호 핀을 가집니다.',
    params: { resistance: 3.0, ke: 0.04, friction: 0.002, maxCurrent: 2 },
  },
  relay: {
    label: '릴레이',
    // 전기적으로 제어되는 접점: 'closed'는 공통(COM) → 통상 개방(NO) 접점이 통전하는지 결정.
    // 스위치처럼 COM/NO 사이 R.
    pins: [
      { name: 'COM', role: 'signal' },
      { name: 'NO', role: 'signal' },
    ],
    description: '릴레이 — 전기적으로 제어되는 스위치. 여자되면(closed) COM과 NO 사이가 통전합니다.',
    params: { closed: false, maxCurrent: 10 },
  },
};

// 인스턴스화된 부품의 기본 타입 (motorL/motorR → motor).
export function baseType(type) {
  if (!type) return type;
  if (type.startsWith('motor')) return 'motor';
  return type;
}

export function defaultParams(type) {
  return { ...(LIBRARY[baseType(type)]?.params || {}) };
}

export function pinsFor(type) {
  return (LIBRARY[baseType(type)]?.pins || []).map(p => ({ ...p }));
}

export function isKnownType(type) {
  return !!LIBRARY[baseType(type)];
}
