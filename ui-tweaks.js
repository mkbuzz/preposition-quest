"use strict";

/* Interface adjustments layered over the main app. */

(() => {
  const style = document.createElement("style");
  style.textContent = `
    .set-stats {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.7rem;
      margin-top: 1rem;
    }

    .set-stat {
      padding: 0.75rem 0.65rem;
      border: 1px solid rgba(37, 99, 235, 0.2);
      border-radius: 0.85rem;
      background: rgba(239, 246, 255, 0.9);
      text-align: center;
    }

    .set-stat-label {
      display: block;
      margin-bottom: 0.2rem;
      color: var(--muted);
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    .set-stat-value {
      display: block;
      color: var(--primary);
      font-size: clamp(1.05rem, 2vw, 1.3rem);
      font-weight: 900;
      line-height: 1.1;
    }

    @media (max-width: 420px) {
      .set-stats {
        gap: 0.5rem;
      }

      .set-stat {
        padding: 0.65rem 0.45rem;
      }
    }
  `;
  document.head.appendChild(style);

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

  window.renderResults = function renderResultsSimplified() {
    const result = state.currentResult;
    const set = getSet(result.setId);
    const exercise = getExercise(set, result.exerciseId);
    const nextExercise = findNextEnabledExercise(set, exercise.id);
    const nextSet = state.data.sets.find((item) => item.number === set.number + 1);

    app.innerHTML = `
      <main class="page">
        ${renderIdentityTopbar()}

        <section class="panel score-panel">
          <p class="hero-kicker" style="color:var(--primary)">Set ${set.number} · ${escapeHtml(exercise.title)}</p>
          <h1 class="section-heading">Your score</h1>
          <div class="score-number">${result.score}/${result.total}</div>
          <div class="score-stars" aria-label="${getStars(result.score)} stars">${renderStars(result.score)}</div>
          <p class="result-summary">${result.percentage}% correct · Attempt ${result.attemptNumber} · ${formatDuration(result.durationSeconds)}</p>
          <div id="submission-status" class="submission-status message info">Saving this result…</div>
        </section>

        <section class="results-list">
          ${result.answers.map((item) => renderResultQuestion(item)).join("")}
        </section>

        <section class="panel">
          <h2 class="section-heading">What would you like to do next?</h2>
          <div class="button-row">
            <button class="btn btn-primary" id="retry-exercise">Retry This Exercise</button>
            ${nextExercise ? `<button class="btn btn-secondary" id="next-exercise">Try ${escapeHtml(nextExercise.title)}</button>` : ""}
            ${nextSet ? `<button class="btn btn-secondary" id="next-set">Continue to Set ${nextSet.number}</button>` : ""}
            <button class="btn btn-ghost" id="back-top">Top Page</button>
          </div>
        </section>
      </main>`;

    bindIdentityTopbar();

    document.getElementById("retry-exercise").addEventListener("click", () => startExercise(set.id, exercise.id));
    document.getElementById("back-top").addEventListener("click", () => {
      state.view = "dashboard";
      render();
    });

    if (nextExercise) {
      document.getElementById("next-exercise").addEventListener("click", () => startExercise(set.id, nextExercise.id));
    }

    if (nextSet) {
      document.getElementById("next-set").addEventListener("click", () => {
        state.currentSetId = nextSet.id;
        state.view = "set";
        render();
      });
    }
  };
})();
