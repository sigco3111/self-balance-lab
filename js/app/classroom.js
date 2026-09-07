// 교실 레이어: 교사가 학급을 만들고(참여 코드 받음), 학생이 코드로 참여하면, 교사는 명부와
// 각 학생의 학습 진도를 CSV 내보내기와 함께 봅니다. cloud.js(Supabase) 기반 — 모든
// 읽기는 RLS로 제한되며, 참가는 SECURITY DEFINER join_class/create_class RPC를 거칩니다
// (supabase/migrations/0002_classroom.sql 참조). 로그인할 때까지 비활성.
import { cloudEnabled, getClient, currentUser } from './cloud.js';

// ── 데이터 ─────────────────────────────────────────────────────────
async function rpc(name, args) {
  const c = await getClient(); if (!c) return { error: '오프라인' };
  const { data, error } = await c.rpc(name, args);
  return { data, error: error ? (error.message || String(error)) : null };
}
export const createClass = (name) => rpc('create_class', { p_name: name });
export const joinClass = (code) => rpc('join_class', { p_code: code });

export async function setDisplayName(name) {
  const c = await getClient(); const u = await currentUser();
  if (!c || !u || !name) return;
  try { await c.from('profiles').update({ display_name: name }).eq('id', u.id); } catch { /* 최선 노력 */ }
}

async function myClasses() {
  const c = await getClient(); const u = await currentUser();
  if (!c || !u) return { taught: [], enrolled: [] };
  const [taughtRes, enrolledRes] = await Promise.all([
    c.from('classes').select('*').eq('teacher_id', u.id).order('created_at'),
    c.from('class_members').select('classes(*)').eq('student_id', u.id),
  ]);
  const taught = taughtRes.data || [];
  const enrolled = (enrolledRes.data || []).map(r => r.classes).filter(Boolean).filter(cl => cl.teacher_id !== u.id);
  return { taught, enrolled };
}

async function rosterWithProgress(classId) {
  const c = await getClient(); if (!c) return [];
  const { data: members } = await c.from('class_members')
    .select('student_id, joined_at, profiles(display_name)').eq('class_id', classId);
  const ids = (members || []).map(m => m.student_id);
  let docs = [];
  if (ids.length) {
    const { data } = await c.from('documents').select('user_id, body').eq('kind', 'progress').in('user_id', ids);
    docs = data || [];
  }
  const byUser = Object.fromEntries(docs.map(d => [d.user_id, d.body || {}]));
  return (members || []).map(m => ({
    id: m.student_id,
    name: (m.profiles && m.profiles.display_name) || '빌더',
    progress: byUser[m.student_id] || {},
  }));
}

function summarize(progress) {
  const vals = Object.values(progress);
  return { completed: vals.filter(s => s > 0).length, stars: vals.reduce((a, s) => a + s, 0) };
}

// ── UI ───────────────────────────────────────────────────────────
export function initClassroom() {
  if (!cloudEnabled()) return { open: () => {} };

  const panel = document.createElement('div');
  panel.id = 'classroom-panel';
  panel.className = 'hidden';
  document.body.appendChild(panel);

  function close() { panel.classList.add('hidden'); panel.innerHTML = ''; }

  async function open() {
    panel.classList.remove('hidden');
    panel.innerHTML = `<div class="cr-card"><div class="cr-head"><h2>교실</h2><button class="cr-close" aria-label="닫기">✕</button></div><div class="cr-body">불러오는 중…</div></div>`;
    panel.querySelector('.cr-close').addEventListener('click', close);
    const u = await currentUser();
    const body = panel.querySelector('.cr-body');
    if (!u) { body.innerHTML = `<p class="cr-empty">학급을 만들거나 참여하려면 로그인하세요.</p>`; return; }
    await renderHome(body);
  }

  async function renderHome(body) {
    const { taught, enrolled } = await myClasses();
    body.innerHTML = `
      <section class="cr-sec">
        <div class="cr-sec-head"><h3>가르치는 학급</h3><button class="cr-btn" id="cr-create">+ 학급 만들기</button></div>
        <div id="cr-taught">${taught.length ? taught.map(cl => `
          <button class="cr-class" data-class="${cl.id}" data-name="${escapeHtml(cl.name)}">
            <span class="cr-class-name">${escapeHtml(cl.name)}</span>
            <span class="cr-code">참여 코드 <b>${cl.join_code}</b></span>
          </button>`).join('') : '<p class="cr-empty">아직 학급이 없어요. 학급을 만들고 참여 코드를 공유하세요.</p>'}</div>
      </section>
      <section class="cr-sec">
        <div class="cr-sec-head"><h3>참여한 학급</h3><button class="cr-btn" id="cr-join">+ 학급 참여</button></div>
        <div id="cr-enrolled">${enrolled.length ? enrolled.map(cl => `
          <div class="cr-class static"><span class="cr-class-name">${escapeHtml(cl.name)}</span></div>`).join('') : '<p class="cr-empty">선생님에게 받은 학급 코드를 입력하세요.</p>'}</div>
      </section>`;
    body.querySelector('#cr-create').addEventListener('click', () => promptCreate(body));
    body.querySelector('#cr-join').addEventListener('click', () => promptJoin(body));
    for (const btn of body.querySelectorAll('[data-class]')) {
      btn.addEventListener('click', () => renderRoster(body, btn.dataset.class, btn.dataset.name));
    }
  }

  function promptCreate(body) {
    const name = window.prompt('학급 이름 (예: "3교시 로봇공학"):', '');
    if (name === null) return;
    createClass(name).then(({ error }) => { if (error) window.alert('학급을 만들 수 없어요: ' + error); renderHome(body); });
  }
  function promptJoin(body) {
    const code = window.prompt('선생님이 알려 주신 학급 코드:', '');
    if (!code) return;
    const name = window.prompt('당신의 이름 (선생님이 찾을 수 있도록):', '');
    joinClass(code).then(async ({ error }) => {
      if (error) { window.alert('참여할 수 없어요: ' + error); return; }
      if (name) await setDisplayName(name);
      renderHome(body);
    });
  }

  async function renderRoster(body, classId, className) {
    body.innerHTML = `<button class="cr-back" id="cr-back">‹ 모든 학급</button>
      <div class="cr-roster-head"><h3>${escapeHtml(className)}</h3><button class="cr-btn" id="cr-csv">CSV 내보내기</button></div>
      <div id="cr-roster">명부 불러오는 중…</div>`;
    body.querySelector('#cr-back').addEventListener('click', () => renderHome(body));
    const rows = await rosterWithProgress(classId);
    const host = body.querySelector('#cr-roster');
    if (!rows.length) { host.innerHTML = '<p class="cr-empty">아직 참여한 학생이 없어요. 학급 코드를 공유해 보세요.</p>'; }
    else {
      host.innerHTML = `<table class="cr-table"><thead><tr><th>학생</th><th>완료한 학습</th><th>별점</th></tr></thead>
        <tbody>${rows.map(r => { const s = summarize(r.progress); return `<tr><td>${escapeHtml(r.name)}</td><td>${s.completed}</td><td>★ ${s.stars}</td></tr>`; }).join('')}</tbody></table>`;
    }
    body.querySelector('#cr-csv').addEventListener('click', () => exportCsv(className, rows));
  }

  function exportCsv(className, rows) {
    const lessonIds = [...new Set(rows.flatMap(r => Object.keys(r.progress)))].sort();
    const header = ['학생', '완료한 학습', '총 별점', ...lessonIds];
    const lines = [header.join(',')];
    for (const r of rows) {
      const s = summarize(r.progress);
      lines.push([csv(r.name), s.completed, s.stars, ...lessonIds.map(id => r.progress[id] || 0)].join(','));
    }
    const blob = new window.Blob([lines.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${className.replace(/[^\w]+/g, '_')}_진도.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return { open };
}

function escapeHtml(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function csv(s) { return /[",\n]/.test(s) ? `"${String(s).replace(/"/g, '""')}"` : s; }
