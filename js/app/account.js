// Account surface: a top-bar chip + a passwordless magic-link modal. Cookieless,
// minimal, in the Lab-Instrument system. Signed-out shows "Sign in"; signed-in
// shows the email + a tier dot and a small popover to sign out. Sync side-effects
// are the caller's job (onSignIn/onSignOut) — this module only owns the UI + auth.
import { cloudEnabled, onAuth, signInWithEmail, signOut } from './cloud.js';

export function initAccount({ onSignIn, onSignOut, onClassroom } = {}) {
  if (!cloudEnabled()) return { signOut: async () => {} };

  const topbar = document.getElementById('topbar');
  const chip = document.createElement('button');
  chip.id = 'account-chip';
  chip.type = 'button';
  chip.className = 'tb-account';
  chip.textContent = '로그인';
  chip.setAttribute('aria-label', '계정');
  topbar.appendChild(chip);

  // ── 매직 링크 모달 ──
  const modal = document.createElement('div');
  modal.id = 'auth-modal';
  modal.className = 'hidden';
  modal.innerHTML = `
    <div class="auth-card" role="dialog" aria-modal="true" aria-labelledby="auth-h">
      <button class="auth-close" type="button" aria-label="닫기">✕</button>
      <div class="auth-mark" aria-hidden="true">◐</div>
      <h2 id="auth-h">작업대를 동기화하세요</h2>
      <p>당신의 작품과 학습 진도는 어떤 기기에서도 함께 따라갑니다. 매직 링크를 이메일로 보내 드릴게요 — 비밀번호 없이.</p>
      <form id="auth-form" novalidate>
        <label class="auth-label" for="auth-email">이메일</label>
        <input id="auth-email" type="email" inputmode="email" autocomplete="email" required placeholder="you@example.com">
        <button type="submit" class="auth-submit">매직 링크 보내기</button>
      </form>
      <div id="auth-msg" class="auth-msg" role="status" aria-live="polite"></div>
    </div>`;
  document.body.appendChild(modal);

  const emailInput = modal.querySelector('#auth-email');
  const msgEl = modal.querySelector('#auth-msg');
  let lastFocus = null;

  function openModal() {
    lastFocus = document.activeElement;
    modal.classList.remove('hidden');
    msgEl.textContent = ''; msgEl.classList.remove('err');
    emailInput.focus();
  }
  function closeModal() {
    modal.classList.add('hidden');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  modal.querySelector('.auth-close').addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeModal();
  });

  modal.querySelector('#auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = emailInput.value.trim();
    if (!email) { msgEl.textContent = '이메일을 입력해 주세요.'; msgEl.classList.add('err'); return; }
    msgEl.classList.remove('err');
    msgEl.textContent = '보내는 중…';
    const { error } = await signInWithEmail(email);
    if (error) { msgEl.textContent = `링크를 보낼 수 없어요: ${error}`; msgEl.classList.add('err'); }
    else { msgEl.textContent = '받은편지함에서 매직 링크를 확인해 주세요 ✉'; }
  });

  // ── signed-in popover ──
  let popover = null;
  let currentUser = null;
  let tier = 'free';
  function closePopover() { if (popover) { popover.remove(); popover = null; } }
  function openPopover() {
    closePopover();
    popover = document.createElement('div');
    popover.className = 'acc-popover';
    popover.innerHTML = `
      <div class="acc-email">${currentUser.email || '로그인됨'}</div>
      <div class="acc-plan">현재 플랜 <b>${tier === 'pro' ? '프로' : '무료'}</b></div>
      <button class="acc-classroom" type="button">교실</button>
      <button class="acc-signout" type="button">로그아웃</button>`;
    topbar.appendChild(popover);
    popover.querySelector('.acc-classroom').addEventListener('click', () => { closePopover(); onClassroom?.(); });
    popover.querySelector('.acc-signout').addEventListener('click', async () => {
      closePopover(); await signOut();
    });
    setTimeout(() => document.addEventListener('click', onDocClick), 0);
  }
  function onDocClick(e) {
    if (popover && !popover.contains(e.target) && e.target !== chip) { closePopover(); document.removeEventListener('click', onDocClick); }
  }

  chip.addEventListener('click', () => {
    if (currentUser) { popover ? closePopover() : openPopover(); }
    else openModal();
  });

  function renderChip(user) {
    currentUser = user;
    closePopover();
    if (user) {
      chip.classList.add('signed-in');
      chip.innerHTML = `<span class="acc-dot ${tier === 'pro' ? 'pro' : ''}" title="${tier === 'pro' ? '프로' : '무료'}"></span><span class="acc-name">${user.email}</span>`;
    } else {
      chip.classList.remove('signed-in');
      chip.textContent = '로그인';
    }
  }

  onAuth((user) => {
    renderChip(user);
    if (user) { closeModal(); onSignIn?.(user); }
    else { onSignOut?.(); }
  });

  return {
    signOut: async () => { await signOut(); },
    setTier: (t) => { tier = (t === 'pro') ? 'pro' : 'free'; if (currentUser) renderChip(currentUser); },
  };
}
