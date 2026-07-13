"use strict";

/*
  Shows a floating link to the custom GPT after the current student has
  completed at least one enabled exercise in every set.
*/

(() => {
  const BUTTON_ID = "custom-gpt-button";

  const style = document.createElement("style");
  style.textContent = `
    #${BUTTON_ID} {
      position: fixed;
      right: max(1rem, env(safe-area-inset-right));
      bottom: max(1rem, env(safe-area-inset-bottom));
      z-index: 1200;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      max-width: min(310px, calc(100vw - 2rem));
      min-height: 52px;
      padding: 0.8rem 1rem;
      border: 1px solid rgba(255, 255, 255, 0.7);
      border-radius: 999px;
      background: linear-gradient(135deg, #1d4ed8, #4338ca);
      box-shadow: 0 14px 32px rgba(30, 64, 175, 0.32);
      color: #fff;
      font: inherit;
      font-weight: 900;
      line-height: 1.2;
      text-align: center;
      text-decoration: none;
      transition: transform 160ms ease, box-shadow 160ms ease;
    }

    #${BUTTON_ID}:hover,
    #${BUTTON_ID}:focus-visible {
      transform: translateY(-2px);
      box-shadow: 0 18px 38px rgba(30, 64, 175, 0.4);
    }

    #${BUTTON_ID}:focus-visible {
      outline: 3px solid rgba(250, 204, 21, 0.95);
      outline-offset: 3px;
    }

    @media (max-width: 760px) {
      #${BUTTON_ID}.exercise-context {
        bottom: calc(9.5rem + env(safe-area-inset-bottom));
      }
    }
  `;
  document.head.appendChild(style);

  function hasCompletedOneExerciseInEverySet() {
    if (!state?.data || !state.selectedClass || !state.selectedStudent) return false;

    const progress = getCurrentStudentProgress();

    return state.data.sets.every((set) => {
      const enabledExercises = set.exercises.filter((exercise) => exercise.enabled);
      return enabledExercises.some((exercise) => Boolean(progress[exercise.id]));
    });
  }

  function updateCustomGptButton() {
    const existing = document.getElementById(BUTTON_ID);
    const url = String(config.customGptUrl || "").trim();
    const shouldShow = Boolean(url) && hasCompletedOneExerciseInEverySet();

    if (!shouldShow) {
      existing?.remove();
      return;
    }

    const button = existing || document.createElement("a");
    button.id = BUTTON_ID;
    button.href = url;
    button.target = "_blank";
    button.rel = "noopener noreferrer";
    button.textContent = config.customGptButtonLabel || "前置詞アウトプット練習へ";
    button.setAttribute("aria-label", "前置詞のアウトプット練習を新しいタブで開く");
    button.classList.toggle("exercise-context", Boolean(document.querySelector(".exercise-page")));

    if (!existing) document.body.appendChild(button);
  }

  const observer = new MutationObserver(() => {
    window.requestAnimationFrame(updateCustomGptButton);
  });

  observer.observe(app, { childList: true, subtree: true });
  window.addEventListener("storage", updateCustomGptButton);
  window.addEventListener("pageshow", updateCustomGptButton);
  updateCustomGptButton();
})();
