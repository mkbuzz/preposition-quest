"use strict";

/* Homework result rules: hide answers and require at least two stars per exercise. */

(() => {
  const GOAL_POPUP_KEY = "prepositionQuest.goalPopups.v1";
  const GOAL_SCORE = Number(config.scoreThresholds?.twoStars) || 10;

  const style = document.createElement("style");
  style.textContent = `
    .homework-goal-message {
      margin: 1rem auto 0;
      max-width: 720px;
      padding: 0.85rem 1rem;
      border-radius: 0.9rem;
      font-weight: 800;
      line-height: 1.5;
      text-align: center;
    }

    .homework-goal-message.achieved {
      border: 1px solid rgba(22, 163, 74, 0.3);
      background: rgba(240, 253, 244, 0.96);
      color: #166534;
    }

    .homework-goal-message.retry {
      border: 1px solid rgba(220, 38, 38, 0.25);
      background: rgba(254, 242, 242, 0.98);
      color: #991b1b;
    }

    .goal-achieved-banner {
      position: fixed;
      top: max(0.65rem, env(safe-area-inset-top));
      left: 50%;
      z-index: 1500;
      width: min(680px, calc(100vw - 2rem));
      padding: 0.58rem 1rem;
      border: 1px solid rgba(22, 163, 74, 0.35);
      border-radius: 999px;
      background: rgba(240, 253, 244, 0.97);
      box-shadow: 0 8px 24px rgba(22, 101, 52, 0.18);
      color: #166534;
      font-size: 0.9rem;
      font-weight: 900;
      line-height: 1.25;
      text-align: center;
      transform: translateX(-50%);
      backdrop-filter: blur(10px);
    }

    .goal-modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 2000;
      display: grid;
      place-items: center;
      padding: 1.25rem;
      background: rgba(15, 23, 42, 0.62);
      backdrop-filter: blur(6px);
    }

    .goal-modal {
      width: min(560px, 100%);
      padding: clamp(1.5rem, 4vw, 2.4rem);
      border: 2px solid rgba(34, 197, 94, 0.45);
      border-radius: 1.5rem;
      background: #fff;
      box-shadow: 0 30px 80px rgba(15, 23, 42, 0.35);
      text-align: center;
    }

    .goal-modal-stars {
      margin-bottom: 0.6rem;
      color: #f59e0b;
      font-size: clamp(2.6rem, 9vw, 4.8rem);
      letter-spacing: 0.06em;
      line-height: 1;
    }

    .goal-modal h2 {
      margin: 0 0 0.7rem;
      color: #166534;
      font-size: clamp(1.5rem, 5vw, 2.2rem);
      line-height: 1.2;
    }

    .goal-modal p {
      margin: 0.45rem 0;
      color: #334155;
      font-size: 1.02rem;
      line-height: 1.55;
    }

    .goal-modal-score {
      margin: 1rem 0;
      color: var(--primary);
      font-size: clamp(1.8rem, 7vw, 3rem);
      font-weight: 900;
    }

    .goal-modal .btn {
      min-width: 180px;
      margin-top: 1rem;
    }

    .answer-feedback.correct,
    .answer-feedback.incorrect {
      font-weight: 900;
    }

    @media (max-width: 760px) {
      .goal-achieved-banner {
        top: max(0.45rem, env(safe-area-inset-top));
        width: calc(100vw - 1rem);
        font-size: 0.82rem;
      }
    }
  `;
  document.head.appendChild(style);

  window.renderResultQuestion = function renderResultQuestionWithoutAnswers(item) {
    const [before, after = ""] = String(item.sentence || "").split("___");
    return `
      <article class="question-card ${item.correct ? "correct" : "incorrect"}">
        <p class="question-english">
          <span class="question-number">${item.questionNumber}</span>
          ${escapeHtml(before)}<strong class="result-blank">___</strong>${escapeHtml(after)}
        </p>
        <p class="question-japanese" lang="ja">${escapeHtml(item.japanese)}</p>
        <div class="answer-feedback ${item.correct ? "correct" : "incorrect"}">
          ${item.correct ? "✓ Correct" : "✗ Incorrect"}
        </div>
      </article>`;
  };

  window.renderResults = function renderHomeworkResults() {
    const result = state.currentResult;
    const set = getSet(result.setId);
    const exercise = getExercise(set, result.exerciseId);
    const nextExercise = findNextEnabledExercise(set, exercise.id);
    const nextSet = state.data.sets.find((item) => item.number === set.number + 1);
    const viewingHistory = Boolean(state.viewingHistory);
    const goalAchieved = result.score >= GOAL_SCORE;

    app.innerHTML = `
      <main class="page">
        ${renderIdentityTopbar()}

        ${goalAchieved ? `
          <div class="goal-achieved-banner" role="status">
            Homework goal achieved for this exercise: ${GOAL_SCORE}/${result.total} or higher (2 stars).
          </div>` : ""}

        <section class="panel score-panel">
          <p class="hero-kicker" style="color:var(--primary)">Set ${set.number} · ${escapeHtml(exercise.title)}</p>
          <h1 class="section-heading">${viewingHistory ? `Attempt ${result.attemptNumber}` : "Your score"}</h1>
          <div class="score-number">${result.score}/${result.total}</div>
          <div class="score-stars" aria-label="${getStars(result.score)} stars">${renderStars(result.score)}</div>
          <p class="result-summary">${result.percentage}% correct · Attempt ${result.attemptNumber} · ${formatDuration(result.durationSeconds)}</p>

          <div class="homework-goal-message ${goalAchieved ? "achieved" : "retry"}">
            ${goalAchieved
              ? "You have reached the minimum homework requirement for this exercise."
              : `The homework goal is 2 stars: ${GOAL_SCORE}/${result.total} or higher. Review the red questions and try again.`}
          </div>

          ${viewingHistory
            ? `<p class="history-note">Completed ${escapeHtml(formatDateTime(result.submittedAt))}</p>`
            : `<div id="submission-status" class="submission-status message info">Sending this result…</div>`}
        </section>

        <section class="results-list">
          ${result.answers.map((item) => renderResultQuestion(item)).join("")}
        </section>

        <section class="panel">
          <h2 class="section-heading">${goalAchieved ? "Continue your homework" : "Try again to reach the goal"}</h2>
          <div class="button-row">
            <button class="btn btn-primary" id="retry-exercise">
              ${goalAchieved ? "Retry This Exercise" : "Try Again for 2 Stars"}
            </button>
            <button class="btn btn-secondary" id="back-set">Return to Set ${set.number} Exercises</button>
            ${!viewingHistory && nextExercise ? `<button class="btn btn-secondary" id="next-exercise">Try ${escapeHtml(nextExercise.title)}</button>` : ""}
            ${!viewingHistory && nextSet ? `<button class="btn btn-secondary" id="next-set">Continue to Set ${nextSet.number}</button>` : ""}
            <button class="btn btn-ghost" id="back-top">Top Page</button>
          </div>
        </section>
      </main>`;

    bindIdentityTopbar();

    document.getElementById("retry-exercise").addEventListener("click", () => startExercise(set.id, exercise.id));
    document.getElementById("back-set").addEventListener("click", () => {
      state.currentSetId = set.id;
      state.viewingHistory = false;
      state.view = "set";
      render();
    });
    document.getElementById("back-top").addEventListener("click", () => {
      state.viewingHistory = false;
      state.view = "dashboard";
      render();
    });

    if (!viewingHistory && nextExercise) {
      document.getElementById("next-exercise").addEventListener("click", () => startExercise(set.id, nextExercise.id));
    }

    if (!viewingHistory && nextSet) {
      document.getElementById("next-set").addEventListener("click", () => {
        state.currentSetId = nextSet.id;
        state.viewingHistory = false;
        state.view = "set";
        render();
      });
    }

    if (!viewingHistory && goalAchieved && shouldShowGoalPopup(result.exerciseId)) {
      markGoalPopupShown(result.exerciseId);
      window.requestAnimationFrame(() => showGoalPopup(result));
    }
  };

  function shouldShowGoalPopup(exerciseId) {
    const shown = getGoalPopupState();
    return !shown[getGoalPopupKey(exerciseId)];
  }

  function markGoalPopupShown(exerciseId) {
    const shown = getGoalPopupState();
    shown[getGoalPopupKey(exerciseId)] = true;
    localStorage.setItem(GOAL_POPUP_KEY, JSON.stringify(shown));
  }

  function getGoalPopupKey(exerciseId) {
    return `${state.selectedClass}:${state.selectedStudent}:${exerciseId}`;
  }

  function getGoalPopupState() {
    try {
      const value = JSON.parse(localStorage.getItem(GOAL_POPUP_KEY) || "{}");
      return value && typeof value === "object" && !Array.isArray(value) ? value : {};
    } catch (error) {
      console.warn("Could not read homework goal popup state", error);
      return {};
    }
  }

  function showGoalPopup(result) {
    const backdrop = document.createElement("div");
    backdrop.className = "goal-modal-backdrop";
    backdrop.setAttribute("role", "dialog");
    backdrop.setAttribute("aria-modal", "true");
    backdrop.setAttribute("aria-labelledby", "goal-modal-title");
    backdrop.innerHTML = `
      <div class="goal-modal">
        <div class="goal-modal-stars" aria-hidden="true">★★</div>
        <h2 id="goal-modal-title">Homework Goal Achieved!</h2>
        <p>You have reached the minimum requirement for this exercise.</p>
        <div class="goal-modal-score">${result.score}/${result.total}</div>
        <p>Complete every exercise and earn at least two stars for the homework assignment.</p>
        <button class="btn btn-primary" id="close-goal-modal">Continue</button>
      </div>`;

    document.body.appendChild(backdrop);
    const closeButton = document.getElementById("close-goal-modal");

    const close = () => {
      backdrop.remove();
      document.removeEventListener("keydown", onKeyDown);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape" || event.key === "Enter") close();
    };

    closeButton.addEventListener("click", close);
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) close();
    });
    document.addEventListener("keydown", onKeyDown);
    closeButton.focus();
  }
})();
