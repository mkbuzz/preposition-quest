"use strict";

/*
  Homework mode:
  - Keeps the assignment goal visible after a student signs in.
  - Hides correct answers on result pages.
  - Encourages retries until the two-star exercise target is reached.
  - Celebrates first-time exercise and full-assignment achievements.
*/

(() => {
  const TWO_STAR_SCORE = Number(config.scoreThresholds?.twoStars ?? 10);
  const ACHIEVEMENT_KEY = "prepositionQuest.homeworkAchievements.v1";
  const MODAL_ID = "homework-achievement-modal";

  const baseRenderDashboard = window.renderDashboard;
  const baseRenderSetPage = window.renderSetPage;
  const baseRenderExercise = window.renderExercise;
  const baseRenderResults = window.renderResults;

  const style = document.createElement("style");
  style.textContent = `
    .homework-goal-banner {
      position: sticky;
      top: 0;
      z-index: 1050;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.8rem;
      width: 100%;
      margin: 0 0 1rem;
      padding: 0.68rem 0.9rem;
      border: 1px solid rgba(37, 99, 235, 0.24);
      border-radius: 0.85rem;
      background: rgba(239, 246, 255, 0.97);
      box-shadow: 0 8px 22px rgba(30, 64, 175, 0.12);
      backdrop-filter: blur(10px);
      color: #1e3a8a;
      font-size: 0.91rem;
      line-height: 1.35;
    }

    .homework-goal-banner.complete {
      border-color: rgba(22, 163, 74, 0.3);
      background: rgba(240, 253, 244, 0.98);
      color: #166534;
    }

    .homework-goal-title {
      display: block;
      margin-bottom: 0.12rem;
      font-weight: 900;
    }

    .homework-goal-progress {
      flex: 0 0 auto;
      padding: 0.38rem 0.65rem;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.82);
      font-size: 0.8rem;
      font-weight: 900;
      white-space: nowrap;
    }

    .exercise-goal-strip {
      margin: -0.25rem 0 1rem;
      padding: 0.72rem 0.9rem;
      border-radius: 0.8rem;
      font-weight: 800;
      text-align: center;
    }

    .exercise-goal-strip.achieved {
      border: 1px solid rgba(22, 163, 74, 0.28);
      background: rgba(240, 253, 244, 0.96);
      color: #166534;
    }

    .exercise-goal-strip.retry {
      border: 1px solid rgba(217, 119, 6, 0.28);
      background: rgba(255, 251, 235, 0.98);
      color: #92400e;
    }

    .answer-feedback.correct,
    .answer-feedback.incorrect {
      font-weight: 900;
    }

    #${MODAL_ID} {
      position: fixed;
      inset: 0;
      z-index: 3000;
      display: grid;
      place-items: center;
      padding: 1.25rem;
      background: rgba(15, 23, 42, 0.62);
      backdrop-filter: blur(5px);
    }

    #${MODAL_ID} .achievement-dialog {
      width: min(560px, 100%);
      padding: clamp(1.5rem, 5vw, 2.4rem);
      border: 2px solid rgba(255, 255, 255, 0.75);
      border-radius: 1.5rem;
      background: #fff;
      box-shadow: 0 28px 70px rgba(15, 23, 42, 0.34);
      text-align: center;
    }

    #${MODAL_ID} .achievement-icon {
      display: grid;
      place-items: center;
      width: 76px;
      height: 76px;
      margin: 0 auto 1rem;
      border-radius: 50%;
      background: linear-gradient(135deg, #16a34a, #22c55e);
      box-shadow: 0 12px 28px rgba(22, 163, 74, 0.26);
      color: #fff;
      font-size: 2.3rem;
    }

    #${MODAL_ID} h2 {
      margin: 0 0 0.7rem;
      color: #14532d;
      font-size: clamp(1.55rem, 5vw, 2.2rem);
    }

    #${MODAL_ID} p {
      margin: 0 auto 1.25rem;
      max-width: 44ch;
      color: #334155;
      line-height: 1.6;
    }

    #${MODAL_ID} .achievement-stars {
      margin-bottom: 1.25rem;
      color: #f59e0b;
      font-size: 2rem;
      letter-spacing: 0.12em;
    }

    @media (max-width: 620px) {
      .homework-goal-banner {
        align-items: flex-start;
        flex-direction: column;
      }

      .homework-goal-progress {
        white-space: normal;
      }
    }
  `;
  document.head.appendChild(style);

  window.renderResultQuestion = function renderResultQuestionWithoutAnswers(item) {
    return `
      <article class="question-card ${item.correct ? "correct" : "incorrect"}">
        <p class="question-english">
          <span class="question-number">${item.questionNumber}</span>
          ${escapeHtml(item.sentence)}
        </p>
        <p class="question-japanese" lang="ja">${escapeHtml(item.japanese)}</p>
        <div class="answer-feedback ${item.correct ? "correct" : "incorrect"}">
          ${item.correct
            ? "✓ Correct"
            : "✗ Incorrect — review this item and try again."}
        </div>
      </article>`;
  };

  window.renderDashboard = function renderDashboardWithHomeworkGoal() {
    baseRenderDashboard();
    insertHomeworkGoalBanner();
  };

  window.renderSetPage = function renderSetPageWithHomeworkGoal() {
    baseRenderSetPage();
    insertHomeworkGoalBanner();
  };

  window.renderExercise = function renderExerciseWithHomeworkGoal(options = {}) {
    baseRenderExercise(options);
    insertHomeworkGoalBanner();
  };

  window.renderResults = function renderResultsWithHomeworkGoal() {
    baseRenderResults();
    insertHomeworkGoalBanner();
    insertExerciseGoalStrip();
    maybeShowAchievementPopup();
  };

  function getHomeworkProgress() {
    const progress = getCurrentStudentProgress();
    const enabledExercises = state.data.sets.flatMap((set) =>
      set.exercises.filter((exercise) => exercise.enabled)
    );
    const completedExercises = enabledExercises.filter((exercise) => Boolean(progress[exercise.id])).length;
    const setsMeetingGoal = state.data.sets.filter((set) =>
      set.exercises
        .filter((exercise) => exercise.enabled)
        .some((exercise) => Number(progress[exercise.id]?.bestScore) >= TWO_STAR_SCORE)
    ).length;

    return {
      completedExercises,
      totalExercises: enabledExercises.length,
      setsMeetingGoal,
      totalSets: state.data.sets.length,
      assignmentComplete:
        completedExercises === enabledExercises.length &&
        setsMeetingGoal === state.data.sets.length
    };
  }

  function insertHomeworkGoalBanner() {
    if (!state.selectedClass || !state.selectedStudent || !state.data) return;

    const main = app.querySelector("main");
    if (!main || main.querySelector(".homework-goal-banner")) return;

    const progress = getHomeworkProgress();
    const banner = document.createElement("div");
    banner.className = `homework-goal-banner${progress.assignmentComplete ? " complete" : ""}`;
    banner.setAttribute("role", "status");
    banner.innerHTML = `
      <div>
        <span class="homework-goal-title">${progress.assignmentComplete ? "Homework requirement achieved" : "Homework goal"}</span>
        <span>Complete all ${progress.totalExercises} exercises and earn at least 2 stars in every set. Two stars = ${TWO_STAR_SCORE}/15 or higher.</span>
      </div>
      <span class="homework-goal-progress">
        ${progress.completedExercises}/${progress.totalExercises} exercises · ${progress.setsMeetingGoal}/${progress.totalSets} sets at 2+ stars
      </span>`;

    main.prepend(banner);
  }

  function insertExerciseGoalStrip() {
    const result = state.currentResult;
    if (!result) return;

    const scorePanel = app.querySelector(".score-panel");
    if (!scorePanel || app.querySelector(".exercise-goal-strip")) return;

    const bestScore = Number(getCurrentStudentProgress()[result.exerciseId]?.bestScore ?? result.score);
    const achieved = bestScore >= TWO_STAR_SCORE;
    const strip = document.createElement("div");
    strip.className = `exercise-goal-strip ${achieved ? "achieved" : "retry"}`;
    strip.textContent = achieved
      ? `Exercise goal achieved: your best score is ${bestScore}/${result.total} (2 or more stars).`
      : `Exercise goal: score ${TWO_STAR_SCORE}/${result.total} or higher. Review the red questions and try again.`;
    scorePanel.insertAdjacentElement("afterend", strip);
  }

  function maybeShowAchievementPopup() {
    if (state.viewingHistory || !state.currentResult) return;

    const result = state.currentResult;
    const progress = getHomeworkProgress();
    const records = getAchievementRecords();
    const studentKey = getStudentStorageKey();
    const studentRecord = records[studentKey] || { exercises: {}, assignment: false };

    if (progress.assignmentComplete && !studentRecord.assignment) {
      studentRecord.assignment = true;
      studentRecord.exercises[result.exerciseId] = true;
      records[studentKey] = studentRecord;
      saveAchievementRecords(records);
      window.setTimeout(() => showAchievementModal({ assignment: true, result }), 120);
      return;
    }

    if (Number(result.score) >= TWO_STAR_SCORE && !studentRecord.exercises[result.exerciseId]) {
      studentRecord.exercises[result.exerciseId] = true;
      records[studentKey] = studentRecord;
      saveAchievementRecords(records);
      window.setTimeout(() => showAchievementModal({ assignment: false, result }), 120);
    }
  }

  function getAchievementRecords() {
    try {
      const records = JSON.parse(localStorage.getItem(ACHIEVEMENT_KEY) || "{}");
      return records && typeof records === "object" ? records : {};
    } catch (error) {
      console.warn("Could not read homework achievement records", error);
      return {};
    }
  }

  function saveAchievementRecords(records) {
    localStorage.setItem(ACHIEVEMENT_KEY, JSON.stringify(records));
  }

  function showAchievementModal({ assignment, result }) {
    document.getElementById(MODAL_ID)?.remove();

    const modal = document.createElement("div");
    modal.id = MODAL_ID;
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "achievement-title");
    modal.innerHTML = `
      <div class="achievement-dialog">
        <div class="achievement-icon" aria-hidden="true">✓</div>
        <h2 id="achievement-title">${assignment ? "Homework requirement achieved!" : "Exercise goal achieved!"}</h2>
        <div class="achievement-stars" aria-hidden="true">★★☆</div>
        <p>
          ${assignment
            ? "You completed every exercise and earned at least two stars in all six sets. The minimum requirement for this assignment has been achieved."
            : `You scored ${result.score}/${result.total} on Set ${result.setNumber}, ${escapeHtml(result.exerciseTitle)}. You have achieved the minimum goal of two stars for this exercise.`}
        </p>
        <button class="btn btn-primary" type="button" id="close-achievement-modal">
          ${assignment ? "Great — View My Results" : "Continue"}
        </button>
      </div>`;

    document.body.appendChild(modal);
    document.body.style.overflow = "hidden";

    const close = () => {
      modal.remove();
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKeydown);
    };
    const handleKeydown = (event) => {
      if (event.key === "Escape") close();
    };

    modal.querySelector("#close-achievement-modal").addEventListener("click", close);
    modal.addEventListener("click", (event) => {
      if (event.target === modal) close();
    });
    document.addEventListener("keydown", handleKeydown);
    modal.querySelector("button").focus();
  }
})();
