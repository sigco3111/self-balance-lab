# 셀프밸런스 랩

> 브라우저만 있으면 정말로 동작하는 전자공작을 — 실제 부품으로, 실제 회로로, 실제 물리로 — 시작할 수 있습니다.

[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Live-brightgreen)](https://sigco3111.github.io/self-balance-lab/)
[![한글화](https://img.shields.io/badge/UI-100%25%20한국어-blue)](#한국어-번역)
[![원본](https://img.shields.io/badge/fork%20of-RaphaelKhalid%2Fself--balance--lab-lightgrey)](https://github.com/RaphaelKhalid/self-balance-lab)
[![라이선스](https://img.shields.io/badge/license-ISC-blue)](./LICENSE)

[셀프밸런스 랩](https://selfbalance-lab.vercel.app/)은 설치가 필요 없는 브라우저 기반 **로봇 공작 공간**입니다. 건전지, 모터, 저항, LED 같은 실제 전자부품을 작업대로 끌어다 놓고 핀끼리 연결하면, **수정된 nodal 해석(Modified Nodal Analysis)** 이 동작 전류를 계산하고 LED를 켜고 모터를 돌립니다. 그리고 **Rapier 물리 시뮬레이션**이 그 회로를 실제 시뮬레이션으로 실행해, 만든 작품이 진짜로 움직이는 모습을 보입니다.

교육자가 안내하는 과정을 따라가는 대신, 빈 작업대 위에 자유롭게 부품을 올리고 자연어 어시스턴트 **헤파이스토스**에게 “양초로 켜지는 조명 같은 거 하나 만들어 봐” 같은 평범한 말로 부탁할 수도 있습니다.

---

## 🚀 30초 만에 시작

설치나 가입, 다운로드가 없습니다. 그저 여세요:

```bash
# 저장소를 클론한 뒤 정적 서버로 실행 (Node npx 또는 Python)
git clone https://github.com/sigco3111/self-balance-lab.git
cd self-balance-lab
npx serve .          # 또는: python -m http.server 8000
```

그 다음 브라우저에서 printed URL을 엽니다. WebGL과 WebAssembly가 지원되는 최신 Chrome/Edge/Firefox/Safari가 필요합니다. **iPad와 iPhone에서도 동작**합니다.

> **바로 사용:** <https://sigco3111.github.io/self-balance-lab/> 에서 호스팅 버전을 열어 보세요.

---

## ✨ 무엇을 만들 수 있는가

| 만들고 싶은 것 | 만드는 방법 |
|---|---|
| 🔋 **손전등** | 건전지 → 저항 → LED. 인스펙터에서 저항 값을 바꿔 밝기를 조절해 보세요. |
| 🔀 **전원 스위치** | 건전지와 전구를 직렬 스위치로 연결. 클릭으로 토글. |
| 🎚️ **모터 속도 조절기** | 가변저항을 모터 직렬에. 노브를 스크롤하면 바퀴가 빨라졌다 늦어집니다. |
| 💡 **🌡️ 빛/열 감지 회로** | 광저항/서미스터를 LED와 함께. 작업대 위의 양초나 전구를 가까이 가져가면 LED가 켜집니다. |
| ⚡ **퓨즈가 끊어지는 회로** | 너무 작은 저항으로 전구를 켜고, 인스펙터에서 퓨즈의 과전류 위반을 확인하세요. |

상상할 수 있는 어떤 조합이든 — 배선을 잘못하면 **합선이 즉시 빨갛게 표시되고**, 저항 값을 너무 작게 잡으면 **LED가 타버리고**, 퓨즈는 정격을 넘으면 **과전류 경고**를 띄웁니다. 모든 게 **MNA 해석기**가 계산한 진짜 값입니다.

---

## 🎯 이 프로젝트가 다른 점

대부분의 브라우저 회로 도구는 회로도만 그리거나 마이크로컨트롤러만 시뮬레이트합니다. 셀프밸런스 랩은 **전기를 실제로 계산**합니다 — 그리고 그 사실이 분명히 드러나야 할 점이 있습니다:

**7.4V 건전지에 LED를 직결**하면 해석기는 **0.44A**가 흐른다고 보고 빨간 합선 마크를 띄웁니다. 기본 100Ω 저항을 끼우면 **48mA**가 LED 정격 30mA를 넘습니다 — 위반도 경고도 없고, 그냥 잘못된 숫자가 나와 있을 뿐입니다. **당신이 저항 값을 정해야 합니다. 물리가 정하는 거지, 채점 기준도, 대규모 언어 모델도 아닙니다.**

이 속성은 동시에 **에이전트 안전**도 만듭니다: 조수는 사람과 같은 동작만 할 수 있고, 해석기가 모든 동작을 검사합니다.

---

## 🧱 작동 방식 — 한 페이지짜리 설계

핵심은 `window.__api`라는 **단일 변경 권위자**입니다. 모든 변경은 다음을 통과합니다:

```
UI 핸들러  ·  테스트  ·  헤파이스토스  ·  스크립트  ·  #build= 링크
                          ↓
                    window.__api
                  (place / remove / connect / set_param / undo / …)
                          ↓
                  RobotDoc v2  (components, nets, params, transforms)
                          ↓
              ── onDocChange 훅 → 모든 모듈이 자동 동기화 ──
```

3D 작업대도, 인스펙터도, HUD도 — **소유한 상태가 없습니다**. 그저 `api.get_document()` 를 호출해 무엇을 그릴지 결정할 뿐이며, 어떤 변경 경로(드래그, 배선, 헤파이스토스, 공유 링크)도 동일한 결과를 만듭니다.

### 코어 모듈

- **`js/model/library.js`** — 16개 부품의 핀/역할/기본 파라미터 정의. 트레이의 기하학, 해석기, 헤파이스토스의 도구 enum이 모두 이 한 파일을 따릅니다.
- **`js/sim/circuit.js`** — MNA 해석기. 순수한 수학 — THREE/DOM 없음. 서버 측에서도 가져올 수 있습니다.
- **`js/sim/creator-sim.js`** — Rapier WASM 물리 + 해석 전류 → 모터 토크 변환.
- **`js/api/index.js`** — `window.__api` (`createApi`). 단일 변경 권위자.
- **`js/app/creator-assembly.js`** — 트레이, 3D 작업대, 핀→핀 배선 — 순수 보기.
- **`js/app/inspector.js`** — 인터랙티브 노브로 회로의 라이브 측정값.
- **`js/app/hephaestus.js`** — 자연어 어시스턴트 (Gemini 기반 클라이언트 도구 루프).
- **`js/app/examples.js`** — 10개의 즉시 만들 수 있는 예제 회로. 아이디어가 말라붙었을 때 클릭 하나.

자세한 아키텍처와 그 결정을 내린 이유는 [`CLAUDE.md`](./CLAUDE.md) 에 있습니다 — 거의 4,000 단어의 “왜 이 파일이 이렇게 생겼는가” 메모입니다.

---

## 🛠️ 16개의 부품

| 카테고리 | 부품 |
|---|---|
| **전원** | 🔋 7.4V 리튬 폴리머 |
| **출력** | ⚙️ DC 기어 모터 + 바퀴 · 💡 LED · 💡 백열 전구 · 🔊 버저 · 🎯 서보 |
| **수동** | ▭ 저항 · ▭ 커패시터 · ▭ 다이오드 · ⏚ 퓨즈 |
| **제어** | 🔀 스위치 · 🔘 푸시 버튼 · 🎚️ 가변저항 · ⛓ 릴레이 |
| **센서** | ☀ 광저항 · 🌡 서미스터 |

그중 어떤 것이든 트레이에서 끌어서 작업대로 가져가거나 헤파이스토스에게 “그거 한 번 만들어 봐” 라고 부탁하세요.

---

## 🤖 헤파이스토스 — 자연어 어시스턴트

헤파이스토스는 평범한 말로 회로를 만들 수 있게 해 주는 클라이언트 에이전트 루프입니다. 흐름:

1. 사용자가 메시지를 보냄 → `{ messages, document }` POST → `/api/hephaestus`
2. 만약 모델이 도구 호출을 반환하면: 각각을 `window.__api`에 대해 실행, 결과를 함수 응답으로 첨부, 1로 다시
3. 그렇지 않으면 모델 텍스트를 보여 주고 중단

모든 도구 호출은 동일한 `window.__api` 표면을 통과하므로 헤파이스토스가 조립한 회로도 손으로 조립한 회로와 완전히 동일한 결과를 만듭니다. **공유된 Gemini 키를 보호하기 위해 무료 사용자는 일일 쿼터**(브라우저당 25 메시지)가 적용되며, 프로 사용자는 무제한입니다.

> ⚠️ **Pages 호스팅 노트**: 무료 GitHub Pages에서는 `/api/hephaestus` 엔드포인트가 없습니다 — 헤파이스토스는 **소프트 실패**(어시스턴트가 사용 불가, 앱 전체는 멀쩡)를 정중히 알립니다. 나머지 셀프밸런스 랩은 백엔드 없이 완전히 동작합니다.

---

## 📱 모든 기기에서 동작

- **데스크톱**: 3열 콕핏 (트레이 | 작업대 | 어시스턴트/인스펙터).
- **태블릿**: 같은 셸, 자동으로 큰 터치 타겟과 제스처. **R 키**는 더블 탭.
- **폰 (≤820px)**: 작업대가 풀 블리드, 트레이와 인스펙터가 하단 시트로, 실행이 고정 하단 바로 이동합니다. **길게 누르기**가 우클릭을, **더블 탭**이 회전을 대신합니다.

다국어 처리된 폰트(Inter, JetBrains Mono, Space Grotesk)와 라이트/다크 토글도 포함.

---

## 🚪 GitHub Pages에 배포

저장소에는 [`.github/workflows/pages.yml`](./.github/workflows/pages.yml) 워크플로우가 들어 있습니다 — `master`에 푸시하면 GitHub Actions가 자동으로 사이트를 빌드하고 게시합니다. Pages는 정적 호스팅이며, `api/`와 `supabase/`은 게으르게 처리됩니다(SPA는 페이지 자체에서 동작).

```yaml
# .github/workflows/pages.yml (포함됨)
on:
  push:
    branches: [master]
# → 자동으로 https://<org>.github.io/self-balance-lab/ 에 게시
```

---

## ⚡ 페이지 디버깅 도구 (선택사항)

인터랙티브 디버깅을 위한 쿼리 파라미터:

- `?perf` — 좌하단에 FPS·프레임 시간·GPU 콜 수 표시.
- `?scan` — 모델링된 룸 대신 3D 스캔 룸(저품질 3.9MB glTF).
- `?scanfit` — 스캔 룸을 다시 맞추는 저작 흐름.
- `?quality=low` / `?quality=high` — 픽셀 비율과 블룸 강도를 강제로 설정.
- `?splat=<url>` — 맞춤 Gaussian splat 백드롭.
- `?bench=...` — `RobotDoc v2`를 base64로 인코딩해 공유 링크 미리보기.

---

## 🧪 한국어 번역

이 포크는 sigco3111의 한글화 작업입니다:

- ✅ **모든 UI 문자열** 100% 한국어 (HTML, JS, 마크다운, 매니페스트, OG 메타)
- ✅ **모든 한글 일관성** — 영문 잔재 없음 (식별자 보호: 클래스 ID, endpoint ID, three.js API 이름은 원본)
- ✅ **이름 규약**:
  - `battery` → “건전지”, `resistor` → “저항”, `switch` → “스위치”, …
  - `Hephaestus` → “헤파이스토스” (AI 어시스턴트)
  - `SelfBalance Lab` → “셀프밸런스 랩” (브랜드)
  - `Potentiometer` → “가변저항”, `Lamp` → “전구”, `LED` → “LED”

번역 중 **보호된 식별자**(변경 시 빌드 실패):

- **Three.js API**: `MeshStandardMaterial`, `Raycaster`, `Vector3`, `Box3`, …
- **CSS**: 모든 클래스 이름, 변수, `data-*` 속성
- **`type` 문자열**: `battery`, `motor`, `resistor`, … (라이브러리 키)
- **Endpoint ID**: `"compId.pin"` 형식 (`"bat1.+"`, `"led1.K"`, …)
- **이벤트 이름**: `EVENTS.LOAD`, `EVENTS.SHARE`, …
- **localStorage 키**: `sbl-*`, `sbl-theme` 등

`API`는 그대로 표기되며 `API` 자체는 그대로입니다(`window.__api`, `createApi`). 국내 독자도 `MNA`, `WASM`, `GPU`, `FPS` 같은 약어는 그대로 읽는다고 가정했습니다.

---

## 📂 저장소 레이아웃

```
self-balance-lab/
├── index.html             # 앱 진입점 (좌측 트레이, 중앙 3D, 우측 패널)
├── landing.html           # 마케팅 페이지
├── 404.html               # Pages 폴백
├── css/
│   ├── tokens.css         # 라이트/다크 색 토큰
│   ├── style.css          # 앱 스타일
│   └── landing.css        # 랜딩 스타일
├── js/
│   ├── main.js            # 오케스트레이터 (장면, 부팅, 클라우드)
│   ├── scene.js           # Three.js + 후처리 셋업
│   ├── audio.js           # 클릭음, 모터음, 빗소리 ambience
│   ├── glossary.js        # 부품과 핀의 평어 설명 — ★ 한글로 번역됨
│   ├── parts.js           # 3D 메시 (배터리, 모터, 라벨)
│   ├── labels.js          # 평면 다국어 라벨
│   ├── model/
│   │   ├── doc.js         # RobotDoc v2
│   │   ├── library.js     # 16개 부품 명세 — ★ 한글로 번역됨
│   │   └── patch.js       # 문서 변경 작업 (add/remove/set/…)
│   ├── api/
│   │   ├── index.js       # window.__api — 단일 변경 권위자
│   │   └── tools.js       # 헤파이스토스의 도구 정의
│   ├── sim/
│   │   ├── circuit.js     # MNA 해석기
│   │   ├── creator-sim.js # Rapier가 해석 전류를 모터 토크로 변환
│   │   └── rapier.js      # WASM 로더
│   └── app/               # UI 모듈 — ★ 대다수 한글로 번역됨
│       ├── topbar.js      · hud.js · inspector.js · coach.js
│       ├── examples.js    · hephaestus.js · creator-assembly.js
│       ├── mobile.js      · classroom.js · account.js · cloud.js
│       ├── props.js       · bench-room.js · benchmarks.js · …
├── api/
│   └── hephaestus.js      # (선택) Vercel Edge — Pages에선 비활성
├── supabase/              # (선택) 클라우드 동기화 — Pages에선 비활성
├── .github/workflows/
│   └── pages.yml          # 자동 Pages 배포
├── tests/                 # Playwright 스위트 (선택사항)
├── docs/                  # 리서치 노트
├── assets/                # HDRI, glTF, 텍스처, 오디오 (CC0)
└── CLAUDE.md              # 아키텍처 노트 (영문 18KB)
```

---

## 🤝 기여 방법

이 저장소는 한 사람의 학습 프로젝트로 시작했지만, 둘 이상의 협력자를 환영합니다.

1. Fork (sigco3111과 동일 포크 정책 — 한 명의 `sigco3111/` repo에서 직접 작업)
2. feature 브랜치를 만들고 (`git checkout -b feature/amazing`)
3. 커밋하고 (`git commit -m '✨ Add X'`)
4. 브랜치에 푸시 (`git push origin feature/amazing`)
5. Pull Request 열기

**번역 변경 후**: 코드를 실행해 보세요 — Python `python -m http.server 8000`로 띄우고, 모든 화면 상태(첫 방문, 작품 로드, 코치 표시, 인스펙터, 어시스턴트, 시뮬레이션)로 둘러보세요. 영문 잔재가 보이면 알려 주세요.

---

## 📜 라이선스

[ISC License](./LICENSE) — 원본 © RaphaelKhalid, 한국어 fork © sigco3111.

---

## 🙏 크레딧

- **저자 (원본)**: [RaphaelKhalid](https://github.com/RaphaelKhalid)
- **MNA 해석**: 원본의 단순 구현. [Wikipedia: Modified nodal analysis](https://en.wikipedia.org/wiki/Modified_nodal_analysis) (Baker, 2024)
- **Three.js**: [mrdoob와 기여자들](https://github.com/mrdoob/three.js/) ([MIT](https://github.com/mrdoob/three.js/blob/master/LICENSE))
- **Rapier3D**: [Dimforge](https://rapier.rs/) ([Apache-2.0](https://github.com/dimforge/rapier.js/blob/master/LICENSE))
- **Poly Haven**: [CC0 자산](https://polyhaven.com/) — 작업대 룸의 모든 glTF 모델
- **ambientCG**: [CC0 PBR 텍스처](https://ambientcg.com/) — 작업대와 벽
- **Lucide**: [아이콘 라이브러리](https://lucide.dev/) ([ISC](https://github.com/lucide-icons/lucide/blob/main/LICENSE))
- **한국어 fork**: [sigco3111](https://github.com/sigco3111)

자세한 라이선스: [`assets/CREDITS.md`](./assets/CREDITS.md).

---

<p align="center">
  <sub>브라우저 한 개로 시작하는 전자공작 · 한국어 fork © 2026 sigco3111</sub>
</p>
