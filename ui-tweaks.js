"use strict";

/* Interface and attempt-history adjustments layered over the main app. */

(() => {
  const originalStartExercise = window.startExercise;

  const style = document.createElement("style");
  style.textContent = `
    .set-stats,
    .exercise-stats {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.7rem;
      margin-top: 1rem;
    }

    .set-stat,
    .exercise-stat {
      padding: 0.75rem 0.65rem;
      border: 1px solid rgba(37, 99, 235, 0.2);
      border-radius: 0.85rem;
      background: rgba(239, 246, 255, 0.9);
      text-align: center;
    }

    .set-stat-label,
    .exercise-stat-label {
      display: block;
      margin-bottom: 0.2rem;
      color: var(--muted);
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    .set-stat-value,
    .exercise-stat-value {
      display: block;
      color: var(--primary);
      font-size: clamp(1.05rem, 2vw, 1.3rem);
      font-weight: 900;
      line-height: 1.1;
    }

    .exercise-card {
      cursor: default;
    }

    .exercise-card-actions {
      display: flex;
      gap: 0.65rem;
      flex-wrap: wrap;
      margin-top: 1rem;
    }

    .exercise-card-actions .btn {
      width: 100%;
    }

    .attempt-history {
      margin-top: 1rem;
      padding-top: 0.9rem;
      border-top: 1px solid var(--border);
    }

    .attempt-history-title {
      display: block;
      margin-bottom: 0.55rem;
      color: var(--muted);
      font-size: 0.78rem;
      font-weight: 800;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .attempt-score-list {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .attempt-score-button {
      min-height: 40px;
      padding: 0.5rem 0.7rem;
      border: 1px solid rgba(37, 99, 235, 0.28);
      border-radius: 999px;
      background: #fff;
      color: var(--primary);
      font: inherit;
      font-size: 0.82rem;
      font-weight: 800;
      cursor: pointer;
    }

    .attempt-score-button:hover,
    .attempt-score-button:focus-visible {
      border-color: var(--primary);
      background: rgba(239, 246, 255, 1);
      transform: translateY(-1px);
    }

    .history-note {
      margin-top: 0.8rem;
      color: var(--muted);
      font-size: 0.9rem;
    }

    @media (max-width: 420px) {
      .set-stats,
      .exercise-stats {
        gap: 0.5rem;
      }

      .set-stat,
      .exercise-stat {
        padding: 0.65rem 0.45rem;
      }
    }
  `;
  document.head.appendChild(style);

  window.startExercise = function startExerciseWithHistoryReset(setId, exerciseId) {
    state.viewingHistory = false;
    return originalStartExercise(setId, exerciseId);
  };

  window.renderIdentityTopbar = function renderIdentityTopbarSimplified() {
    return `
      <div class="topbar">
        <div class="topbar-left">
          <span class="identity-chip">Class: ${escapeHtml(state.selectedClass)}</span>
          <span class="identity-chip">Student: ${escapeHtml(state.selectedStudent)}</span>
        </div>
      </div>`;
  };

  window.bindIdentityTopbar = function bindIdentityTopbarSimplified() {};

  window.renderSetCard = function renderSetCardWithProminentScores(set, progress) {
    const enabled = set.exercises.filter((exercise) => exercise.enabled);
    const completed = enabled.filter((exercise) => progress[exercise.id]).length;
    const scores = enabled
      .map((exercise) => progress[exercise.id]?.bestScore)
      .filter(Number.isFinite);
    const bestScore = scores.length ? Math.max(...scores) : null;
    const total = enabled[0]?.questions.length || 15;

    return `
      <button class="set-card" data-open-set="${escapeAttribute(set.id)}">
        <span class="set-number">Set ${set.number}</span>
        <h2>${escapeHtml(set.shortTitle || set.title)}</h2>
        <div class="card-description">${escapeHtml(set.description)}</div>
        <div class="set-stats" aria-label="Set progress">
          <div class="set-stat">
            <span class="set-stat-label">Best score</span>
            <span class="set-stat-value">${bestScore === null ? "—" : `${bestScore}/${total}`}</span>
          </div>
          <div class="set-stat">
            <span class="set-stat-label">Completed</span>
            <span class="set-stat-value">${completed}/${enabled.length}</span>
          </div>
        </div>
        <div class="star-row" aria-label="${getStars(bestScore)} stars">${renderStars(bestScore)}</div>
      </button>`;
  };

  window.renderSetPage = function renderSetPageWithAttemptHistory() {
    const set = getSet(state.currentSetId);
    const progress = getCurrentStudentProgress();

    app.innerHTML = `
      <main class="page">
        <div class="topbar">
          <div class="topbar-left">
            <button class="btn btn-ghost" id="back-dashboard">← All Sets</button>
            <span class="identity-chip">${escapeHtml(state.selectedClass)} · ${escapeHtml(state.selectedStudent)}</span>
          </div>
        </div>

        <section class="hero">
          <p class="hero-kicker">Set ${set.number}</p>
          <h1>${escapeHtml(set.title)}</h1>
          <p>${escapeHtml(set.description)}</p>
        </section>

        <section class="panel">
          <h2 class="section-heading">Word bank</h2>
          <p class="section-note">${set.wordBank.map(escapeHtml).join(" · ")}</p>

          <div class="exercise-grid">
            ${set.exercises.map((exercise) => renderExerciseCardWithHistory(set, exercise, progress)).join("")}
          </div>
        </section>
      </main>`;

    document.getElementById("back-dashboard").addEventListener("click", () => {
      state.view = "dashboard";
      render();
    });

    document.querySelectorAll("[data-start-exercise]").forEach((button) => {
      button.addEventListener("click", () => startExercise(set.id, button.dataset.startExercise));
    });

    document.querySelectorAll("[data-view-attempt]").forEach((button) => {
      button.addEventListener("click", () => openPastAttempt(button.dataset.viewAttempt));
    });
  };

  function renderExerciseCardWithHistory(set, exercise, progress) {
    const record = progress[exercise.id];
    const total = exercise.questions.length || 15;
    const status = exercise.enabled ? "available" : "soon";
    const attempts = getAttemptsForExercise(exercise.id);

    return `
      <article class="exercise-card">
        <span class="status-pill ${status}">${exercise.enabled ? "Available" : "Coming soon"}</span>
        <h3>${escapeHtml(exercise.title)}</h3>
        <div class="card-description">
          ${exercise.enabled ? `${exercise.questions.length} questions` : "This exercise is not available yet."}
        </div>

        ${exercise.enabled ? `
          <div class="exercise-stats" aria-label="Exercise progress">
            <div class="exercise-stat">
              <span class="exercise-stat-label">Best score</span>
              <span class="exercise-stat-value">${record ? `${record.bestScore}/${total}` : "—"}</span>
            </div>
            <div class="exercise-stat">
              <span class="exercise-stat-label">Attempts</span>
              <span class="exercise-stat-value">${record?.attempts || 0}</span>
            </div>
          </div>

          <div class="star-row">${renderStars(record?.bestScore ?? null)}</div>

          <div class="exercise-card-actions">
            <button class="btn btn-primary" data-start-exercise="${escapeAttribute(exercise.id)}">
              ${attempts.length ? "Try Again" : "Start Exercise"}
            </button>
          </div>

          ${attempts.length ? `
            <div class="attempt-history">
              <span class="attempt-history-title">Past scores</span>
              <div class="attempt-score-list">
                ${attempts.map((attempt) => `
                  <button class="attempt-score-button" data-view-attempt="${escapeAttribute(attempt.submissionId)}" title="View Attempt ${attempt.attemptNumber}">
                    Attempt ${attempt.attemptNumber}: ${attempt.score}/${attempt.total}
                  </button>`).join("")}
              </div>
            </div>` : ""}
        ` : ""}
      </article>`;
  }

  function getAttemptsForExercise(exerciseId) {
    return getStorageArray(ATTEMPTS_KEY)
      .filter((attempt) =>
        attempt.classCode === state.selectedClass &&
        attempt.studentId === state.selectedStudent &&
        attempt.exerciseId === exerciseId
      )
      .sort((a, b) => {
        const attemptDifference = Number(a.attemptNumber || 0) - Number(b.attemptNumber || 0);
        if (attemptDifference !== 0) return attemptDifference;
        return new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
      });
  }

  function openPastAttempt(submissionId) {
    const attempt = getStorageArray(ATTEMPTS_KEY).find((item) =>
      item.submissionId === submissionId &&
      item.classCode === state.selectedClass &&
      item.studentId === state.selectedStudent
    );

    if (!attempt) {
      window.alert("This past result is no longer stored on this device.");
      return;
    }

    state.currentSetId = attempt.setId;
    state.currentExerciseId = attempt.exerciseId;
    state.currentResult = attempt;
    state.viewingHistory = true;
    state.view = "results";
    render();
  }

  window.renderResults = function renderResultsWithSetReturn() {
    const result = state.currentResult;
    const set = getSet(result.setId);
    const exercise = getExercise(set, result.exerciseId);
    const nextExercise = findNextEnabledExercise(set, exercise.id);
    const nextSet = state.data.sets.find((item) => item.number === set.number + 1);
    const viewingHistory = Boolean(state.viewingHistory);

    app.innerHTML = `
      <main class="page">
        ${renderIdentityTopbar()}

        <section class="panel score-panel">
          <p class="hero-kicker" style="color:var(--primary)">Set ${set.number} · ${escapeHtml(exercise.title)}</p>
          <h1 class="section-heading">${viewingHistory ? `Attempt ${result.attemptNumber}` : "Your score"}</h1>
          <div class="score-number">${result.score}/${result.total}</div>
          <div class="score-stars" aria-label="${getStars(result.score)} stars">${renderStars(result.score)}</div>
          <p class="result-summary">${result.percentage}% correct · Attempt ${result.attemptNumber} · ${formatDuration(result.durationSeconds)}</p>
          ${viewingHistory
            ? `<p class="history-note">Completed ${escapeHtml(formatDateTime(result.submittedAt))}</p>`
            : `<div id="submission-status" class="submission-status message info">Sending this result…</div>`}
        </section>

        <section class="results-list">
          ${result.answers.map((item) => renderResultQuestion(item)).join("")}
        </section>

        <section class="panel">
          <h2 class="section-heading">What would you like to do next?</h2>
          <div class="button-row">
            <button class="btn btn-primary" id="retry-exercise">Retry This Exercise</button>
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
  };

  /*
    Apps Script accepts the no-CORS POST, but a follow-up JSONP confirmation can
    fail in browsers signed into multiple Google accounts. Treat a completed POST
    as sent; the Apps Script backend already rejects duplicate submission IDs.
  */
  window.sendResultToBackend = async function sendResultWithoutAccountConfirmation(result) {
    const status = document.getElementById("submission-status");

    if (config.demoMode || !config.submissionEndpoint) {
      queuePendingSubmission(result);
      if (status) {
        status.className = "submission-status message info";
        status.textContent = "Saved on this device.";
      }
      return;
    }

    queuePendingSubmission(result);

    try {
      await fetch(config.submissionEndpoint, {
        method: "POST",
        mode: "no-cors",
        keepalive: true,
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "submitResult", payload: result })
      });

      removePendingSubmission(result.submissionId);
      if (status) {
        status.className = "submission-status message success";
        status.textContent = "Result sent successfully.";
      }
    } catch (error) {
      console.error(error);
      if (status) {
        status.className = "submission-status message error";
        status.textContent = "The result could not be sent. A copy is saved on this device and will be retried automatically.";
      }
    }
  };

  window.flushPendingSubmissions = async function flushPendingSubmissionsWithoutConfirmation() {
    if (config.demoMode || !config.submissionEndpoint) return;

    const pending = getStorageArray(PENDING_KEY);
    if (!pending.length) return;

    for (const result of pending.slice()) {
      try {
        await fetch(config.submissionEndpoint, {
          method: "POST",
          mode: "no-cors",
          keepalive: true,
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({ action: "submitResult", payload: result })
        });
        removePendingSubmission(result.submissionId);
      } catch (error) {
        console.warn("Pending submission could not be sent", error);
        break;
      }
    }
  };
})();
