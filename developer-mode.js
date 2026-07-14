"use strict";

/*
  Hidden developer test mode.
  Open the site with ?test=1 or ?admin=1 to bypass class/name selection.
  Test attempts stay on the current device and are never sent to Google Sheets.
*/

(() => {
  const parameters = new URLSearchParams(window.location.search);
  const enabled = parameters.get("test") === "1" || parameters.get("admin") === "1";
  if (!enabled) return;

  const TEST_CLASS = "TEST";
  const TEST_STUDENT = "Developer";
  const BADGE_ID = "developer-test-badge";

  const style = document.createElement("style");
  style.textContent = `
    body.developer-test-mode::before {
      content: "";
      position: fixed;
      inset: 0;
      z-index: 1190;
      pointer-events: none;
      border: 4px solid rgba(217, 119, 6, 0.72);
    }

    #${BADGE_ID} {
      position: fixed;
      left: max(1rem, env(safe-area-inset-left));
      bottom: max(1rem, env(safe-area-inset-bottom));
      z-index: 1300;
      display: flex;
      align-items: center;
      gap: 0.65rem;
      padding: 0.7rem 0.8rem;
      border: 1px solid rgba(255, 255, 255, 0.72);
      border-radius: 0.9rem;
      background: rgba(120, 53, 15, 0.96);
      box-shadow: 0 12px 28px rgba(120, 53, 15, 0.28);
      color: #fff;
      font-weight: 900;
    }

    #${BADGE_ID} button {
      min-height: 36px;
      padding: 0.45rem 0.7rem;
      border: 1px solid rgba(255, 255, 255, 0.72);
      border-radius: 999px;
      background: #fff;
      color: #78350f;
      font: inherit;
      font-weight: 900;
      cursor: pointer;
    }

    @media (max-width: 760px) {
      #${BADGE_ID}.exercise-context {
        bottom: calc(9.5rem + env(safe-area-inset-bottom));
      }
    }
  `;
  document.head.appendChild(style);

  window.sendResultToBackend = async function sendTestResultLocallyOnly() {
    const status = document.getElementById("submission-status");
    if (status) {
      status.className = "submission-status message info";
      status.textContent = "Developer test mode: saved on this device only. Not sent to Google Sheets.";
    }
  };

  function addBadge() {
    let badge = document.getElementById(BADGE_ID);
    if (!badge) {
      badge = document.createElement("div");
      badge.id = BADGE_ID;
      badge.innerHTML = `<span>Developer Test Mode</span><button type="button">Exit</button>`;
      badge.querySelector("button").addEventListener("click", exitTestMode);
      document.body.appendChild(badge);
    }
    badge.classList.toggle("exercise-context", Boolean(document.querySelector(".exercise-page")));
  }

  function exitTestMode() {
    const url = new URL(window.location.href);
    url.searchParams.delete("test");
    url.searchParams.delete("admin");
    window.location.replace(url.toString());
  }

  function enterTestMode() {
    if (!state?.data) {
      window.setTimeout(enterTestMode, 60);
      return;
    }

    document.body.classList.add("developer-test-mode");
    state.selectedClass = TEST_CLASS;
    state.selectedStudent = TEST_STUDENT;
    state.enteredPasskey = "";
    state.authMessage = "";
    state.authLoading = false;
    state.currentSetId = null;
    state.currentExerciseId = null;
    state.currentResult = null;
    state.answers = [];
    state.viewingHistory = false;
    state.view = "dashboard";
    render();
    addBadge();
  }

  const observer = new MutationObserver(() => {
    window.requestAnimationFrame(addBadge);
  });
  observer.observe(app, { childList: true, subtree: true });

  enterTestMode();
})();
