"use strict";

const LIVE_DATA_URL = "../data/exercises.json";
const ADDITIONAL_DATA_URL = "data/additional-sets.json";
const PROGRESS_KEY = "prepositionQuest.toPost.progress.v1";
const ATTEMPTS_KEY = "prepositionQuest.toPost.attempts.v1";

const state = {
  data: null,
  view: "loading",
  currentSetId: null,
  currentExerciseId: null,
  currentQuestions: [],
  answers: [],
  activeQuestionIndex: 0,
  activeBlankIndex: 0,
  startedAt: null,
  currentResult: null
};

const app = document.getElementById("app");

init();

async function init() {
  try {
    const [liveResponse, additionalResponse] = await Promise.all([
      fetch(LIVE_DATA_URL, { cache: "no-store" }),
      fetch(ADDITIONAL_DATA_URL, { cache: "no-store" })
    ]);

    if (!liveResponse.ok) {
      throw new Error(`Could not load the live exercise data (${liveResponse.status}).`);
    }
    if (!additionalResponse.ok) {
      throw new Error(`Could not load the TO-POST exercise data (${additionalResponse.status}).`);
    }

    const liveData = await liveResponse.json();
    const additionalData = await additionalResponse.json();
    const mergedSets = [...liveData.sets, ...additionalData.sets]
      .map(normalizeSet)
      .sort((a, b) => a.number - b.number);

    state.data = {
      ...liveData,
      appSubtitle: "Explore sixteen preposition sets, including multi-blank combination exercises.",
      sets: mergedSets
    };

    validateData(state.data);
    state.view = "dashboard";
    render();
  } catch (error) {
    console.error(error);
    renderError(error);
  }
}

function normalizeSet(set) {
  const normalized = structuredClone(set);
  normalized.exercises = normalized.exercises.map((exercise) => ({
    ...exercise,
    enabled: Boolean(exercise.enabled),
    questions: Array.isArray(exercise.questions) ? exercise.questions : []
  }));
  return normalized;
}

function validateData(data) {
  if (!data || !Array.isArray(data.sets)) {
    throw new Error("The merged exercise data has an invalid structure.");
  }

  const exerciseIds = new Set();
  const questionIds = new Set();

  data.sets.forEach((set) => {
    if (!set.id || !Array.isArray(set.exercises)) {
      throw new Error(`Invalid data in ${set.id || "an unnamed set"}.`);
    }

    set.exercises.forEach((exercise) => {
      if (exerciseIds.has(exercise.id)) {
        throw new Error(`Duplicate exercise ID: ${exercise.id}`);
      }
      exerciseIds.add(exercise.id);

      if (!exercise.enabled) return;
      if (!exercise.questions.length) {
        throw new Error(`${exercise.id} is enabled but has no questions.`);
      }

      const bank = getExerciseWordBank(set, exercise);
      exercise.questions.forEach((question) => {
        if (questionIds.has(question.id)) {
          throw new Error(`Duplicate question ID: ${question.id}`);
        }
        questionIds.add(question.id);

        const answers = getQuestionAnswers(question);
        const blankCount = countBlanks(question.sentence);
        if (blankCount !== answers.length) {
          throw new Error(`${question.id} has ${blankCount} blanks but ${answers.length} answers.`);
        }
        answers.forEach((answer) => {
          if (!bank.includes(answer)) {
            throw new Error(`${question.id}: “${answer}” is not in the exercise word bank.`);
          }
        });
      });
    });
  });
}

function render() {
  document.onkeydown = null;
  window.scrollTo({ top: 0, behavior: "auto" });

  switch (state.view) {
    case "dashboard":
      renderDashboard();
      break;
    case "set":
      renderSetPage();
      break;
    case "exercise":
      renderExercise();
      break;
    case "results":
      renderResults();
      break;
    default:
      renderDashboard();
  }
}

function renderError(error) {
  app.innerHTML = `
    <main class="page">
      <section class="panel compact">
        <p class="hero-kicker" style="color:var(--danger)">TO-POST</p>
        <h1 class="section-heading">Unable to load the staging app</h1>
        <p class="section-note">${escapeHtml(error.message)}</p>
      </section>
    </main>`;
}

function renderTopbar(backLabel = null) {
  return `
    <div class="topbar">
      <div class="topbar-left">
        ${backLabel ? `<button class="btn btn-ghost" id="topbar-back">← ${escapeHtml(backLabel)}</button>` : ""}
        <span class="identity-chip">TO-POST · Developer</span>
      </div>
      <div class="topbar-right">
        <a class="btn btn-ghost" href="../" aria-label="Open the live Preposition Quest app">Live App</a>
      </div>
    </div>`;
}

function bindTopbarBack(handler) {
  const button = document.getElementById("topbar-back");
  if (button && handler) button.addEventListener("click", handler);
}

function renderToPostNotice({ showReset = true } = {}) {
  return `
    <aside class="to-post-notice" role="note">
      <div>
        <strong>TO-POST</strong>
        This version is not linked from the live app. Progress remains on this device and no results are sent to Google Sheets.
      </div>
      ${showReset ? `<button class="btn btn-ghost" id="reset-to-post">Reset TO-POST Progress</button>` : ""}
    </aside>`;
}

function bindResetButton() {
  const button = document.getElementById("reset-to-post");
  if (!button) return;
  button.addEventListener("click", () => {
    if (!window.confirm("Reset all scores and attempts stored for TO-POST on this browser?")) return;
    localStorage.removeItem(PROGRESS_KEY);
    localStorage.removeItem(ATTEMPTS_KEY);
    render();
  });
}

function renderDashboard() {
  const progress = getProgress();
  const enabledExercises = getEnabledExercises();
  const attempted = enabledExercises.filter(({ exercise }) => progress[exercise.id]).length;
  const completionRate = enabledExercises.length
    ? Math.round((attempted / enabledExercises.length) * 100)
    : 0;

  const singleBlankSets = state.data.sets.filter((set) => set.number <= 8);
  const multiBlankSets = state.data.sets.filter((set) => set.number >= 9);

  app.innerHTML = `
    <main class="page">
      ${renderTopbar()}
      ${renderToPostNotice()}

      <section class="hero">
        <p class="hero-kicker">TO-POST</p>
        <h1>${escapeHtml(state.data.appTitle)}</h1>
        <p>${escapeHtml(state.data.appSubtitle)}</p>
        <div class="progress-wrap">
          <div class="progress-row"><span>TO-POST exercises attempted</span><span>${attempted}/${enabledExercises.length}</span></div>
          <div class="progress-track"><div class="progress-fill" style="width:${completionRate}%"></div></div>
        </div>
      </section>

      <section class="panel">
        ${renderSetSection("Sets 1–8", "Single-preposition exercises · 15 points each", singleBlankSets, progress)}
        ${renderSetSection("Sets 9–16", "Combination exercises · partial credit for each blank", multiBlankSets, progress)}
      </section>
    </main>`;

  bindResetButton();
  document.querySelectorAll("[data-open-set]").forEach((button) => {
    button.addEventListener("click", () => {
      state.currentSetId = button.dataset.openSet;
      state.view = "set";
      render();
    });
  });
}

function renderSetSection(title, description, sets, progress) {
  return `
    <div class="set-section-heading">
      <h2>${escapeHtml(title)}</h2>
      <p>${escapeHtml(description)}</p>
    </div>
    <div class="set-grid to-post-grid">
      ${sets.map((set) => renderSetCard(set, progress)).join("")}
    </div>`;
}

function renderSetCard(set, progress) {
  const enabled = set.exercises.filter((exercise) => exercise.enabled);
  const attempted = enabled.filter((exercise) => progress[exercise.id]).length;
  const records = enabled.map((exercise) => ({ exercise, record: progress[exercise.id] })).filter((item) => item.record);
  const multiBlank = set.number >= 9;
  const pointTotals = [...new Set(enabled.map(getExerciseTotal))];
  const pointsLabel = pointTotals.length === 1 ? `${pointTotals[0]} points` : `${Math.min(...pointTotals)}–${Math.max(...pointTotals)} points`;

  let bestLabel = "Not attempted";
  if (records.length) {
    const best = records.reduce((current, item) => {
      const ratio = item.record.bestScore / getExerciseTotal(item.exercise);
      return !current || ratio > current.ratio ? { ...item, ratio } : current;
    }, null);
    bestLabel = `Best: <strong>${best.record.bestScore}/${getExerciseTotal(best.exercise)}</strong>`;
  }

  return `
    <button class="set-card" data-open-set="${escapeAttribute(set.id)}" data-new-set="${set.number >= 7}" data-multi-blank="${multiBlank}">
      <span class="set-number">Set ${set.number}</span>
      <h2>${escapeHtml(set.shortTitle || set.title)}</h2>
      <div class="card-description">${escapeHtml(set.description || "")}</div>
      <div class="card-meta">
        ${enabled.length} exercises · ${pointsLabel}<br>
        ${bestLabel}<br>
        Attempted: ${attempted}/${enabled.length}
      </div>
    </button>`;
}

function renderSetPage() {
  const set = getSet(state.currentSetId);
  const progress = getProgress();
  const hasSharedBank = Array.isArray(set.wordBank) && set.wordBank.length > 0;

  app.innerHTML = `
    <main class="page">
      ${renderTopbar("All Sets")}
      ${renderToPostNotice({ showReset: false })}

      <section class="hero">
        <p class="hero-kicker">TO-POST · Set ${set.number}</p>
        <h1>${escapeHtml(set.title)}</h1>
        <p>${escapeHtml(set.description || "")}</p>
      </section>

      <section class="panel">
        <h2 class="section-heading">${hasSharedBank ? "Word bank" : "Exercise word banks"}</h2>
        <p class="section-note">
          ${hasSharedBank
            ? set.wordBank.slice().sort(compareWords).map(escapeHtml).join(" · ")
            : "Each exercise uses a manageable selection from the larger mixed-preposition bank."}
        </p>
        <div class="exercise-grid">
          ${set.exercises.map((exercise) => renderExerciseCard(set, exercise, progress)).join("")}
        </div>
      </section>
    </main>`;

  bindTopbarBack(() => {
    state.view = "dashboard";
    render();
  });

  document.querySelectorAll("[data-start-exercise]").forEach((button) => {
    button.addEventListener("click", () => startExercise(set.id, button.dataset.startExercise));
  });
}

function renderExerciseCard(set, exercise, progress) {
  const record = progress[exercise.id];
  const total = getExerciseTotal(exercise);
  const thresholds = getThresholds(exercise);
  const blanksPerQuestion = getBlankCountRange(exercise);

  return `
    <button class="exercise-card" ${exercise.enabled ? `data-start-exercise="${escapeAttribute(exercise.id)}"` : "disabled"}>
      <span class="status-pill ${exercise.enabled ? "available" : "soon"}">${exercise.enabled ? "Available" : "Coming soon"}</span>
      <span class="points-pill">${total} points</span>
      <h3>${escapeHtml(exercise.title)}</h3>
      <div class="card-description">
        ${exercise.questions.length} sentences · ${blanksPerQuestion} · 3 stars from ${thresholds.threeStars}/${total}
      </div>
      <div class="card-meta">
        ${record ? `Best: <strong>${record.bestScore}/${total}</strong><br>Attempts: ${record.attempts}` : "Not attempted"}
      </div>
      <div class="star-row" aria-label="${getStars(record?.bestScore ?? null, exercise)} stars">${renderStars(record?.bestScore ?? null, exercise)}</div>
    </button>`;
}

function getBlankCountRange(exercise) {
  const counts = exercise.questions.map((question) => getQuestionAnswers(question).length);
  const min = Math.min(...counts);
  const max = Math.max(...counts);
  if (min === max) return `${min} blank${min === 1 ? "" : "s"} each`;
  return `${min}–${max} blanks each`;
}

function startExercise(setId, exerciseId) {
  const set = getSet(setId);
  const exercise = getExercise(set, exerciseId);
  if (!exercise || !exercise.enabled) return;

  state.currentSetId = setId;
  state.currentExerciseId = exerciseId;
  state.currentQuestions = shuffle(exercise.questions);
  state.answers = state.currentQuestions.map((question) => Array(getQuestionAnswers(question).length).fill(null));
  state.activeQuestionIndex = 0;
  state.activeBlankIndex = 0;
  state.startedAt = Date.now();
  state.currentResult = null;
  state.view = "exercise";
  render();
}

function renderExercise(options = {}) {
  const set = getSet(state.currentSetId);
  const exercise = getExercise(set, state.currentExerciseId);
  const answeredCount = countAnsweredBlanks();
  const total = getExerciseTotal(exercise);
  const allAnswered = answeredCount === total;
  const bank = getExerciseWordBank(set, exercise).slice().sort(compareWords);
  const activeAnswerCount = state.answers[state.activeQuestionIndex]?.length || 1;

  app.innerHTML = `
    <main class="page exercise-page">
      ${renderTopbar(`Set ${set.number}`)}

      <header class="exercise-header">
        <p class="hero-kicker">TO-POST</p>
        <h1>Set ${set.number} · ${escapeHtml(exercise.title)}</h1>
        <div class="exercise-header-meta">
          <span>${escapeHtml(set.title)}</span>
          <span>${state.currentQuestions.length} sentences</span>
          <span>${total} points</span>
        </div>
        <div class="exercise-instructions">Click a blank, then select a preposition. Multiple answers are entered from left to right.</div>
      </header>

      <div class="exercise-layout">
        <section class="question-column" aria-label="Exercise questions">
          ${state.currentQuestions.map((question, index) => renderQuestion(question, index)).join("")}

          <div class="exercise-footer">
            <div class="answer-count">Answered: ${answeredCount}/${total} blanks</div>
            <button class="btn btn-primary" id="submit-answers" ${allAnswered ? "" : "disabled"}>Submit Answers</button>
          </div>
        </section>

        <aside class="word-bank-panel ${bank.length > 15 ? "large-bank" : ""}" aria-label="Word bank">
          <div class="word-bank-heading">
            <h2>Word Bank</h2>
            <span>Q${state.activeQuestionIndex + 1} · Blank ${state.activeBlankIndex + 1}/${activeAnswerCount}</span>
          </div>
          <p class="word-bank-subtitle">Alphabetical order · words may be used more than once</p>
          <div class="word-bank-buttons">
            ${bank.map((word) => `<button class="word-button" data-word="${escapeAttribute(word)}">${escapeHtml(word)}</button>`).join("")}
          </div>
        </aside>
      </div>
    </main>`;

  bindTopbarBack(() => leaveExercise(set.id));

  document.querySelectorAll("[data-question-index][data-blank-index]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeQuestionIndex = Number(button.dataset.questionIndex);
      state.activeBlankIndex = Number(button.dataset.blankIndex);
      updateActiveQuestionHighlight();
    });
  });

  document.querySelectorAll("[data-word]").forEach((button) => {
    button.addEventListener("click", () => selectWord(button.dataset.word));
  });

  document.getElementById("submit-answers").addEventListener("click", submitAnswers);

  if (options.scrollToActive) {
    requestAnimationFrame(() => scrollToQuestion(state.activeQuestionIndex));
  }
}

function renderQuestion(question, questionIndex) {
  const answers = state.answers[questionIndex];
  const parts = String(question.sentence).split("___");
  const active = questionIndex === state.activeQuestionIndex;
  const multiBlank = answers.length > 1;
  let sentenceHtml = escapeHtml(parts[0]);

  answers.forEach((answer, blankIndex) => {
    const isActive = active && blankIndex === state.activeBlankIndex;
    sentenceHtml += `
      <button class="blank-button ${answer ? "answered" : ""} ${isActive ? "active-blank" : ""}"
        data-question-index="${questionIndex}"
        data-blank-index="${blankIndex}"
        aria-label="Answer blank ${blankIndex + 1} for question ${questionIndex + 1}">
        ${multiBlank ? `<span class="blank-position">${blankIndex + 1}</span>` : ""}
        ${answer ? escapeHtml(answer) : "_______"}
      </button>${escapeHtml(parts[blankIndex + 1] || "")}`;
  });

  return `
    <article class="question-card ${active ? "active" : ""} ${multiBlank ? "multi-blank" : ""}" id="question-${questionIndex}">
      <p class="question-english">
        <span class="question-number">${questionIndex + 1}</span>
        ${sentenceHtml}
      </p>
      <p class="question-japanese" lang="ja">${escapeHtml(question.japanese || "")}</p>
    </article>`;
}

function updateActiveQuestionHighlight() {
  document.querySelectorAll(".question-card").forEach((card, index) => {
    card.classList.toggle("active", index === state.activeQuestionIndex);
  });
  document.querySelectorAll(".blank-button").forEach((button) => {
    const active = Number(button.dataset.questionIndex) === state.activeQuestionIndex &&
      Number(button.dataset.blankIndex) === state.activeBlankIndex;
    button.classList.toggle("active-blank", active);
  });

  const counter = document.querySelector(".word-bank-heading span");
  const blankTotal = state.answers[state.activeQuestionIndex]?.length || 1;
  if (counter) counter.textContent = `Q${state.activeQuestionIndex + 1} · Blank ${state.activeBlankIndex + 1}/${blankTotal}`;
  scrollToQuestion(state.activeQuestionIndex);
}

function selectWord(word) {
  state.answers[state.activeQuestionIndex][state.activeBlankIndex] = word;
  const next = findNextUnanswered(state.activeQuestionIndex, state.activeBlankIndex);
  if (next) {
    state.activeQuestionIndex = next.questionIndex;
    state.activeBlankIndex = next.blankIndex;
  }
  renderExercise({ scrollToActive: true });
}

function findNextUnanswered(questionIndex, blankIndex) {
  const positions = [];
  state.answers.forEach((answers, qIndex) => {
    answers.forEach((answer, bIndex) => positions.push({ qIndex, bIndex, answer }));
  });

  const currentFlatIndex = positions.findIndex((position) => position.qIndex === questionIndex && position.bIndex === blankIndex);
  for (let offset = 1; offset <= positions.length; offset += 1) {
    const position = positions[(currentFlatIndex + offset) % positions.length];
    if (position.answer === null) {
      return { questionIndex: position.qIndex, blankIndex: position.bIndex };
    }
  }
  return null;
}

function leaveExercise(setId) {
  const hasAnswers = state.answers.some((answers) => answers.some((answer) => answer !== null));
  if (hasAnswers && !window.confirm("Leave this exercise? Your current answers will be cleared.")) return;
  state.currentSetId = setId;
  state.view = "set";
  render();
}

function countAnsweredBlanks() {
  return state.answers.reduce((sum, answers) => sum + answers.filter((answer) => answer !== null).length, 0);
}

function submitAnswers() {
  const set = getSet(state.currentSetId);
  const exercise = getExercise(set, state.currentExerciseId);
  const total = getExerciseTotal(exercise);
  if (countAnsweredBlanks() !== total) return;

  const questionResults = state.currentQuestions.map((question, questionIndex) => {
    const correctAnswers = getQuestionAnswers(question);
    const studentAnswers = state.answers[questionIndex];
    const blankResults = correctAnswers.map((correctAnswer, blankIndex) => ({
      blankNumber: blankIndex + 1,
      studentAnswer: studentAnswers[blankIndex],
      correctAnswer,
      correct: studentAnswers[blankIndex] === correctAnswer
    }));

    return {
      questionId: question.id,
      questionNumber: questionIndex + 1,
      sentence: question.sentence,
      japanese: question.japanese,
      blankResults,
      correctCount: blankResults.filter((item) => item.correct).length,
      totalBlanks: blankResults.length,
      correct: blankResults.every((item) => item.correct)
    };
  });

  const score = questionResults.reduce((sum, item) => sum + item.correctCount, 0);
  const durationSeconds = Math.max(1, Math.round((Date.now() - state.startedAt) / 1000));
  const attemptNumber = updateProgress(exercise.id, score, total);

  state.currentResult = {
    submittedAt: new Date().toISOString(),
    setId: set.id,
    setNumber: set.number,
    setTitle: set.title,
    exerciseId: exercise.id,
    exerciseTitle: exercise.title,
    score,
    total,
    percentage: Math.round((score / total) * 100),
    attemptNumber,
    durationSeconds,
    answers: questionResults
  };

  saveAttempt(state.currentResult);
  state.view = "results";
  render();
}

function renderResults() {
  const result = state.currentResult;
  const set = getSet(result.setId);
  const exercise = getExercise(set, result.exerciseId);
  const thresholds = getThresholds(exercise);
  const nextExercise = findNextEnabledExercise(set, exercise.id);
  const nextSet = state.data.sets.find((item) => item.number === set.number + 1);

  app.innerHTML = `
    <main class="page">
      ${renderTopbar(`Set ${set.number}`)}
      ${renderToPostNotice({ showReset: false })}

      <section class="panel score-panel">
        <p class="hero-kicker" style="color:var(--to-post)">TO-POST · Set ${set.number} · ${escapeHtml(exercise.title)}</p>
        <h1 class="section-heading">Your score</h1>
        <div class="score-number">${result.score}/${result.total}</div>
        <div class="score-stars" aria-label="${getStars(result.score, exercise)} stars">${renderStars(result.score, exercise)}</div>
        <p class="result-summary">${result.percentage}% correct · Attempt ${result.attemptNumber} · ${formatDuration(result.durationSeconds)}</p>
        <p class="score-threshold-note">3 stars: ${thresholds.threeStars}+ · 2 stars: ${thresholds.twoStars}+ · 1 star: ${thresholds.oneStar}+</p>
        <div class="local-only-note">Correct answers are not displayed. Each blank earns one point, so partially correct sentences receive partial credit.</div>
      </section>

      <section class="results-list">
        ${result.answers.map(renderResultQuestion).join("")}
      </section>

      <section class="panel">
        <h2 class="section-heading">Continue testing TO-POST</h2>
        <div class="button-row">
          <button class="btn btn-primary" id="retry-exercise">Retry This Exercise</button>
          <button class="btn btn-secondary" id="back-set">Return to Set ${set.number}</button>
          ${nextExercise ? `<button class="btn btn-secondary" id="next-exercise">Try ${escapeHtml(nextExercise.title)}</button>` : ""}
          ${nextSet ? `<button class="btn btn-secondary" id="next-set">Continue to Set ${nextSet.number}</button>` : ""}
          <button class="btn btn-ghost" id="back-dashboard">All Sets</button>
        </div>
      </section>
    </main>`;

  bindTopbarBack(() => {
    state.view = "set";
    render();
  });

  document.getElementById("retry-exercise").addEventListener("click", () => startExercise(set.id, exercise.id));
  document.getElementById("back-set").addEventListener("click", () => {
    state.view = "set";
    render();
  });
  document.getElementById("back-dashboard").addEventListener("click", () => {
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
}

function renderResultQuestion(item) {
  return `
    <article class="question-card ${item.correct ? "correct" : "incorrect"}">
      <p class="question-english">
        <span class="question-number">${item.questionNumber}</span>
        ${renderSentenceWithEmptyBlanks(item.sentence)}
      </p>
      <p class="question-japanese" lang="ja">${escapeHtml(item.japanese || "")}</p>
      <div class="answer-feedback ${item.correct ? "correct" : "incorrect"}">
        ${item.correct
          ? `✓ Correct — ${item.correctCount}/${item.totalBlanks} blank${item.totalBlanks === 1 ? "" : "s"}`
          : `✗ ${item.correctCount}/${item.totalBlanks} blanks correct — review and try again.`}
      </div>
      ${item.totalBlanks > 1 ? `
        <div class="blank-result-row">
          ${item.blankResults.map((blank) => `
            <span class="blank-result ${blank.correct ? "correct" : "incorrect"}">
              Blank ${blank.blankNumber} ${blank.correct ? "✓" : "✗"}
            </span>`).join("")}
        </div>` : ""}
    </article>`;
}

function renderSentenceWithEmptyBlanks(sentence) {
  const parts = String(sentence).split("___");
  return parts.map((part, index) => {
    const blank = index < parts.length - 1 ? `<strong class="result-blank">___</strong>` : "";
    return `${escapeHtml(part)}${blank}`;
  }).join("");
}

function getSet(setId) {
  return state.data.sets.find((set) => set.id === setId);
}

function getExercise(set, exerciseId) {
  return set?.exercises.find((exercise) => exercise.id === exerciseId);
}

function getEnabledExercises() {
  return state.data.sets.flatMap((set) =>
    set.exercises.filter((exercise) => exercise.enabled).map((exercise) => ({ set, exercise }))
  );
}

function findNextEnabledExercise(set, currentExerciseId) {
  const enabled = set.exercises.filter((exercise) => exercise.enabled);
  const index = enabled.findIndex((exercise) => exercise.id === currentExerciseId);
  return index >= 0 ? enabled[index + 1] || null : null;
}

function getExerciseWordBank(set, exercise) {
  const bank = Array.isArray(exercise.wordBank) && exercise.wordBank.length
    ? exercise.wordBank
    : set.wordBank;
  return Array.isArray(bank) ? [...new Set(bank)] : [];
}

function getQuestionAnswers(question) {
  if (Array.isArray(question.answers)) return question.answers;
  return question.answer !== undefined ? [question.answer] : [];
}

function countBlanks(sentence) {
  return (String(sentence).match(/___/g) || []).length;
}

function getExerciseTotal(exercise) {
  if (Number.isFinite(Number(exercise.totalPoints))) return Number(exercise.totalPoints);
  return exercise.questions.reduce((total, question) => total + getQuestionAnswers(question).length, 0);
}

function getThresholds(exercise) {
  const total = getExerciseTotal(exercise);
  const supplied = exercise.starThresholds || {};
  if (Number.isFinite(Number(supplied.threeStars))) {
    return {
      threeStars: Number(supplied.threeStars),
      twoStars: Number(supplied.twoStars),
      oneStar: Number(supplied.oneStar)
    };
  }

  if (total === 15) return { threeStars: 13, twoStars: 10, oneStar: 7 };
  return {
    threeStars: Math.ceil(total * 0.86),
    twoStars: Math.ceil(total * 0.66),
    oneStar: Math.ceil(total * 0.46)
  };
}

function getStars(score, exercise) {
  if (!Number.isFinite(Number(score))) return 0;
  const thresholds = getThresholds(exercise);
  if (score >= thresholds.threeStars) return 3;
  if (score >= thresholds.twoStars) return 2;
  if (score >= thresholds.oneStar) return 1;
  return 0;
}

function renderStars(score, exercise) {
  const stars = getStars(score, exercise);
  return Array.from({ length: 3 }, (_, index) => index < stars ? "★" : "☆").join("");
}

function getProgress() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PROGRESS_KEY) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    console.warn("Could not read TO-POST progress", error);
    return {};
  }
}

function updateProgress(exerciseId, score, total) {
  const progress = getProgress();
  const existing = progress[exerciseId] || { bestScore: 0, attempts: 0, total };
  const next = {
    bestScore: Math.max(existing.bestScore || 0, score),
    attempts: (existing.attempts || 0) + 1,
    total,
    lastScore: score,
    lastSubmitted: new Date().toISOString()
  };
  progress[exerciseId] = next;
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  return next.attempts;
}

function saveAttempt(result) {
  try {
    const attempts = JSON.parse(localStorage.getItem(ATTEMPTS_KEY) || "[]");
    const safeAttempts = Array.isArray(attempts) ? attempts : [];
    safeAttempts.push(result);
    localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(safeAttempts.slice(-250)));
  } catch (error) {
    console.warn("Could not save TO-POST attempt", error);
  }
}

function shuffle(items) {
  const copy = items.slice();
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]];
  }
  return copy;
}

function compareWords(a, b) {
  return String(a).localeCompare(String(b), "en", { sensitivity: "base" });
}

function scrollToQuestion(index) {
  const element = document.getElementById(`question-${index}`);
  if (element) element.scrollIntoView({ behavior: "smooth", block: "center" });
}

function formatDuration(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (!minutes) return `${seconds}s`;
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}
