"use strict";

const DATA_URL = "data/exercises.json";
const SESSION_KEY = "prepositionQuest.session.v1";
const PROGRESS_KEY = "prepositionQuest.progress.v1";
const ATTEMPTS_KEY = "prepositionQuest.attempts.v1";
const PENDING_KEY = "prepositionQuest.pendingSubmissions.v1";

const state = {
  data: null,
  view: "loading",
  selectedClass: null,
  enteredPasskey: "",
  selectedStudent: null,
  currentSetId: null,
  currentExerciseId: null,
  answers: [],
  activeQuestionIndex: 0,
  startedAt: null,
  currentResult: null,
  authMessage: "",
  authLoading: false
};

const app = document.getElementById("app");
const config = window.APP_CONFIG || {};

init();

async function init() {
  try {
    const response = await fetch(DATA_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`Could not load exercise data (${response.status}).`);
    state.data = await response.json();
    validateData(state.data);
    restoreSession();
    render();
    flushPendingSubmissions();
  } catch (error) {
    console.error(error);
    app.innerHTML = `
      <main class="page">
        <section class="panel compact">
          <h1 class="section-heading">Unable to load the app</h1>
          <p class="section-note">${escapeHtml(error.message)}</p>
          <p class="footer-note">When testing on your computer, open the folder through a local web server rather than opening index.html directly.</p>
        </section>
      </main>`;
  }
}

function validateData(data) {
  if (!data || !Array.isArray(data.classes) || !Array.isArray(data.sets)) {
    throw new Error("The exercise data file has an invalid structure.");
  }

  const exerciseIds = new Set();
  data.sets.forEach((set) => {
    if (!set.id || !Array.isArray(set.wordBank) || !Array.isArray(set.exercises)) {
      throw new Error(`Invalid data in ${set.id || "an unnamed set"}.`);
    }
    set.exercises.forEach((exercise) => {
      if (exerciseIds.has(exercise.id)) {
        throw new Error(`Duplicate exercise ID: ${exercise.id}`);
      }
      exerciseIds.add(exercise.id);
      if (exercise.enabled) {
        if (!Array.isArray(exercise.questions) || exercise.questions.length === 0) {
          throw new Error(`${exercise.id} is enabled but has no questions.`);
        }
        exercise.questions.forEach((question) => {
          if ((question.sentence.match(/___/g) || []).length !== 1) {
            throw new Error(`${question.id} must contain exactly one ___ blank.`);
          }
          if (!set.wordBank.includes(question.answer)) {
            throw new Error(`${question.id}: answer is not in the word bank.`);
          }
        });
      }
    });
  });
}

function restoreSession() {
  try {
    const session = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
    if (
      session &&
      state.data.classes.some((item) => item.id === session.classId) &&
      isValidStudentId(session.classId, session.studentId)
    ) {
      state.selectedClass = session.classId;
      state.selectedStudent = session.studentId;
      state.view = "dashboard";
      return;
    }
  } catch (error) {
    console.warn("Could not restore session", error);
  }
  state.view = "classSelect";
}

function render() {
  document.onkeydown = null;
  window.scrollTo({ top: 0, behavior: "auto" });

  switch (state.view) {
    case "classSelect":
      renderClassSelect();
      break;
    case "passkey":
      renderPasskey();
      break;
    case "studentSelect":
      renderStudentSelect();
      break;
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
      renderClassSelect();
  }
}

function renderClassSelect() {
  const demoNotice = config.demoMode
    ? `<div class="message info"><strong>Setup preview:</strong> Local passkey checking is enabled for testing. Connect Google Apps Script before publishing this site to students.</div>`
    : "";

  app.innerHTML = `
    <main class="page">
      <section class="hero">
        <p class="hero-kicker">Preposition practice game</p>
        <h1>${escapeHtml(state.data.appTitle)}</h1>
        <p>${escapeHtml(state.data.appSubtitle)}</p>
      </section>

      <section class="panel">
        <h2 class="section-heading">Choose your class</h2>
        <p class="section-note">Select your class to begin.</p>
        <div class="class-grid">
          ${state.data.classes.map((item) => `
            <button class="class-card" data-class-id="${escapeAttribute(item.id)}">
              <span class="class-badge">${escapeHtml(item.label)}</span>
              <h2>${escapeHtml(item.label)}</h2>
              <div class="card-description">${escapeHtml(item.description)}</div>
            </button>`).join("")}
        </div>
        ${demoNotice}
      </section>
    </main>`;

  document.querySelectorAll("[data-class-id]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedClass = button.dataset.classId;
      state.enteredPasskey = "";
      state.authMessage = "";
      state.view = "passkey";
      render();
    });
  });
}

function renderPasskey() {
  const classInfo = getClass(state.selectedClass);
  const dots = Array.from({ length: 4 }, (_, index) =>
    `<span class="passkey-dot ${index < state.enteredPasskey.length ? "filled" : ""}" aria-hidden="true"></span>`
  ).join("");

  app.innerHTML = `
    <main class="page">
      <div class="topbar">
        <button class="btn btn-ghost" id="back-class">← Back</button>
        <span class="identity-chip">Class: ${escapeHtml(classInfo.label)}</span>
      </div>

      <section class="panel compact">
        <h1 class="section-heading">Enter the ${escapeHtml(classInfo.label)} passkey</h1>
        <p class="section-note">Use the number pad to enter the four-digit class passkey.</p>
        <div class="passkey-display" aria-label="${state.enteredPasskey.length} of 4 digits entered">${dots}</div>
        <div class="keypad" aria-label="Number pad">
          ${[1,2,3,4,5,6,7,8,9].map((number) => `<button data-digit="${number}">${number}</button>`).join("")}
          <button id="clear-passkey" aria-label="Clear passkey">Clear</button>
          <button data-digit="0">0</button>
          <button id="submit-passkey" aria-label="Enter passkey">Enter</button>
        </div>
        ${state.authMessage ? `<div class="message ${state.authMessage.startsWith("Incorrect") || state.authMessage.startsWith("Unable") ? "error" : "info"}">${escapeHtml(state.authMessage)}</div>` : ""}
      </section>
    </main>`;

  document.getElementById("back-class").addEventListener("click", () => {
    state.selectedClass = null;
    state.enteredPasskey = "";
    state.authMessage = "";
    state.view = "classSelect";
    render();
  });

  document.querySelectorAll("[data-digit]").forEach((button) => {
    button.addEventListener("click", () => addPasskeyDigit(button.dataset.digit));
  });

  document.getElementById("clear-passkey").addEventListener("click", clearPasskey);
  document.getElementById("submit-passkey").addEventListener("click", submitPasskey);

  document.onkeydown = (event) => {
    if (/^[0-9]$/.test(event.key)) addPasskeyDigit(event.key);
    if (event.key === "Backspace" || event.key === "Delete") clearPasskey();
    if (event.key === "Enter") submitPasskey();
  };
}

function addPasskeyDigit(digit) {
  if (state.authLoading || state.enteredPasskey.length >= 4) return;
  state.enteredPasskey += digit;
  state.authMessage = "";
  renderPasskey();
}

function clearPasskey() {
  if (state.authLoading) return;
  state.enteredPasskey = "";
  state.authMessage = "";
  renderPasskey();
}

async function submitPasskey() {
  if (state.authLoading) return;
  if (state.enteredPasskey.length !== 4) {
    state.authMessage = "Enter all four digits.";
    renderPasskey();
    return;
  }

  state.authLoading = true;
  state.authMessage = "Checking passkey…";
  renderPasskey();

  try {
    const valid = await validateClassPasskey(state.selectedClass, state.enteredPasskey);
    if (!valid) {
      state.enteredPasskey = "";
      state.authMessage = "Incorrect passkey. Please try again.";
      state.authLoading = false;
      renderPasskey();
      return;
    }

    state.enteredPasskey = "";
    state.authMessage = "";
    state.authLoading = false;
    state.selectedStudent = null;
    state.view = "studentSelect";
    render();
  } catch (error) {
    console.error(error);
    state.authMessage = "Unable to check the passkey. Please try again.";
    state.authLoading = false;
    renderPasskey();
  }
}

async function validateClassPasskey(classId, passkey) {
  if (config.demoMode) {
    await wait(220);
    return Boolean(config.demoPasskeys && config.demoPasskeys[classId] === passkey);
  }

  if (!config.submissionEndpoint) {
    throw new Error("The Google Apps Script endpoint is not configured.");
  }

  const response = await fetch(config.submissionEndpoint, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: "validateClass", classCode: classId, passkey })
  });

  if (!response.ok) throw new Error("Passkey validation request failed.");
  const result = await response.json();
  return result && result.success === true;
}

function renderStudentSelect() {
  const classInfo = getClass(state.selectedClass);
  const ids = getStudentIds(classInfo);

  app.innerHTML = `
    <main class="page">
      <div class="topbar">
        <button class="btn btn-ghost" id="back-passkey">← Back</button>
        <span class="identity-chip">Class: ${escapeHtml(classInfo.label)}</span>
      </div>

      <section class="panel">
        <h1 class="section-heading">Choose your student ID</h1>
        <p class="section-note">Select your own ID, then confirm your choice.</p>
        <div class="student-grid">
          ${ids.map((id) => `
            <button class="student-button ${state.selectedStudent === id ? "selected" : ""}" data-student-id="${id}">${id}</button>
          `).join("")}
        </div>
        <div class="button-row">
          <button class="btn btn-primary" id="confirm-student" ${state.selectedStudent ? "" : "disabled"}>
            ${state.selectedStudent ? `Continue as ${escapeHtml(state.selectedStudent)}` : "Choose an ID"}
          </button>
        </div>
        ${state.selectedStudent ? `<div class="message info">You selected <strong>${escapeHtml(state.selectedStudent)}</strong>. Confirm that this is your own student ID.</div>` : ""}
      </section>
    </main>`;

  document.getElementById("back-passkey").addEventListener("click", () => {
    state.selectedStudent = null;
    state.view = "passkey";
    render();
  });

  document.querySelectorAll("[data-student-id]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedStudent = button.dataset.studentId;
      renderStudentSelect();
    });
  });

  document.getElementById("confirm-student").addEventListener("click", () => {
    if (!state.selectedStudent) return;
    saveSession();
    state.view = "dashboard";
    render();
  });
}

function renderDashboard() {
  const progress = getCurrentStudentProgress();
  const enabledExercises = state.data.sets.flatMap((set) => set.exercises.filter((exercise) => exercise.enabled));
  const completed = enabledExercises.filter((exercise) => progress[exercise.id]).length;
  const completionRate = enabledExercises.length ? Math.round((completed / enabledExercises.length) * 100) : 0;

  app.innerHTML = `
    <main class="page">
      ${renderIdentityTopbar()}
      <section class="hero">
        <p class="hero-kicker">Student dashboard</p>
        <h1>${escapeHtml(state.data.appTitle)}</h1>
        <p>Choose a set. Your best scores are saved on this browser for ${escapeHtml(state.selectedStudent)}.</p>
        <div class="progress-wrap">
          <div class="progress-row"><span>Overall completion</span><span>${completed}/${enabledExercises.length}</span></div>
          <div class="progress-track"><div class="progress-fill" style="width:${completionRate}%"></div></div>
        </div>
      </section>

      <section class="panel">
        <h2 class="section-heading">Choose a set</h2>
        <p class="section-note">Each set has its own word bank. Additional exercises can be added through the JSON data file.</p>
        <div class="set-grid">
          ${state.data.sets.map((set) => renderSetCard(set, progress)).join("")}
        </div>
      </section>
    </main>`;

  bindIdentityTopbar();
  document.querySelectorAll("[data-open-set]").forEach((button) => {
    button.addEventListener("click", () => {
      state.currentSetId = button.dataset.openSet;
      state.view = "set";
      render();
    });
  });
}

function renderSetCard(set, progress) {
  const enabled = set.exercises.filter((exercise) => exercise.enabled);
  const completed = enabled.filter((exercise) => progress[exercise.id]).length;
  const scores = enabled.map((exercise) => progress[exercise.id]?.bestScore).filter(Number.isFinite);
  const bestScore = scores.length ? Math.max(...scores) : null;
  const total = enabled[0]?.questions.length || 15;

  return `
    <button class="set-card" data-open-set="${escapeAttribute(set.id)}">
      <span class="set-number">Set ${set.number}</span>
      <h2>${escapeHtml(set.shortTitle || set.title)}</h2>
      <div class="card-description">${escapeHtml(set.description)}</div>
      <div class="card-meta">
        ${bestScore === null ? "Not attempted" : `Best: <strong>${bestScore}/${total}</strong>`}<br>
        Completed: ${completed}/${enabled.length}
      </div>
      <div class="star-row" aria-label="${getStars(bestScore)} stars">${renderStars(bestScore)}</div>
    </button>`;
}

function renderSetPage() {
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
          ${set.exercises.map((exercise) => renderExerciseCard(set, exercise, progress)).join("")}
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
}

function renderExerciseCard(set, exercise, progress) {
  const record = progress[exercise.id];
  const total = exercise.questions.length || 15;
  const status = exercise.enabled ? "available" : "soon";
  return `
    <button class="exercise-card" ${exercise.enabled ? `data-start-exercise="${escapeAttribute(exercise.id)}"` : "disabled"}>
      <span class="status-pill ${status}">${exercise.enabled ? "Available" : "Coming soon"}</span>
      <h3>${escapeHtml(exercise.title)}</h3>
      <div class="card-description">
        ${exercise.enabled ? `${exercise.questions.length} questions` : "Add questions in exercises.json to activate this exercise."}
      </div>
      <div class="card-meta">
        ${record ? `Best: <strong>${record.bestScore}/${total}</strong><br>Attempts: ${record.attempts}` : "Not attempted"}
      </div>
      <div class="star-row">${renderStars(record?.bestScore ?? null)}</div>
    </button>`;
}

function startExercise(setId, exerciseId) {
  const set = getSet(setId);
  const exercise = set.exercises.find((item) => item.id === exerciseId);
  if (!exercise || !exercise.enabled) return;

  state.currentSetId = setId;
  state.currentExerciseId = exerciseId;
  state.answers = Array(exercise.questions.length).fill(null);
  state.activeQuestionIndex = 0;
  state.startedAt = Date.now();
  state.currentResult = null;
  state.view = "exercise";
  render();
}

function renderExercise(options = {}) {
  const set = getSet(state.currentSetId);
  const exercise = getExercise(set, state.currentExerciseId);
  const answeredCount = state.answers.filter((answer) => answer !== null).length;
  const allAnswered = answeredCount === exercise.questions.length;

  app.innerHTML = `
    <main class="page exercise-page">
      <div class="topbar">
        <div class="topbar-left">
          <button class="btn btn-ghost" id="leave-exercise">← Set ${set.number}</button>
          <span class="identity-chip">${escapeHtml(state.selectedClass)} · ${escapeHtml(state.selectedStudent)}</span>
        </div>
      </div>

      <header class="exercise-header">
        <h1>Set ${set.number} · ${escapeHtml(exercise.title)}</h1>
        <div class="exercise-header-meta">
          <span>${escapeHtml(set.title)}</span>
          <span>${exercise.questions.length} questions</span>
          <span>Click a blank, then choose from the word bank.</span>
        </div>
      </header>

      <div class="exercise-layout">
        <section class="question-column" aria-label="Exercise questions">
          ${exercise.questions.map((question, index) => renderQuestion(question, index)).join("")}

          <div class="exercise-footer">
            <div class="answer-count">Answered: ${answeredCount}/${exercise.questions.length}</div>
            <button class="btn btn-primary" id="submit-answers" ${allAnswered ? "" : "disabled"}>Submit Answers</button>
          </div>
        </section>

        <aside class="word-bank-panel" aria-label="Word bank">
          <div class="word-bank-heading">
            <h2>Word Bank</h2>
            <span>${state.activeQuestionIndex + 1}/${exercise.questions.length}</span>
          </div>
          <div class="word-bank-buttons">
            ${set.wordBank.map((word) => `<button class="word-button" data-word="${escapeAttribute(word)}">${escapeHtml(word)}</button>`).join("")}
          </div>
        </aside>
      </div>
    </main>`;

  document.getElementById("leave-exercise").addEventListener("click", () => {
    const hasAnswers = state.answers.some((answer) => answer !== null);
    if (!hasAnswers || window.confirm("Leave this exercise? Your current answers will be cleared.")) {
      state.view = "set";
      render();
    }
  });

  document.querySelectorAll("[data-question-index]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeQuestionIndex = Number(button.dataset.questionIndex);
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

function renderQuestion(question, index) {
  const answer = state.answers[index];
  const active = index === state.activeQuestionIndex;
  const [before, after] = question.sentence.split("___");

  return `
    <article class="question-card ${active ? "active" : ""}" id="question-${index}">
      <p class="question-english">
        <span class="question-number">${index + 1}</span>
        ${escapeHtml(before)}
        <button class="blank-button ${answer ? "answered" : ""}" data-question-index="${index}" aria-label="Answer blank for question ${index + 1}">
          ${answer ? escapeHtml(answer) : "_______"}
        </button>
        ${escapeHtml(after)}
      </p>
      <p class="question-japanese" lang="ja">${escapeHtml(question.japanese)}</p>
    </article>`;
}

function updateActiveQuestionHighlight() {
  document.querySelectorAll(".question-card").forEach((card, index) => {
    card.classList.toggle("active", index === state.activeQuestionIndex);
  });
  const counter = document.querySelector(".word-bank-heading span");
  if (counter) counter.textContent = `${state.activeQuestionIndex + 1}/${state.answers.length}`;
  scrollToQuestion(state.activeQuestionIndex);
}

function selectWord(word) {
  const currentIndex = state.activeQuestionIndex;
  state.answers[currentIndex] = word;

  const nextUnanswered = findNextUnanswered(currentIndex + 1);
  if (nextUnanswered !== -1) {
    state.activeQuestionIndex = nextUnanswered;
  }

  renderExercise({ scrollToActive: true });
}

function findNextUnanswered(startIndex) {
  for (let index = startIndex; index < state.answers.length; index += 1) {
    if (state.answers[index] === null) return index;
  }
  for (let index = 0; index < startIndex; index += 1) {
    if (state.answers[index] === null) return index;
  }
  return -1;
}

function scrollToQuestion(index) {
  const element = document.getElementById(`question-${index}`);
  if (element) element.scrollIntoView({ behavior: "smooth", block: "center" });
}

function submitAnswers() {
  const set = getSet(state.currentSetId);
  const exercise = getExercise(set, state.currentExerciseId);
  if (state.answers.some((answer) => answer === null)) return;

  const questionResults = exercise.questions.map((question, index) => ({
    questionId: question.id,
    questionNumber: index + 1,
    sentence: question.sentence,
    japanese: question.japanese,
    studentAnswer: state.answers[index],
    correctAnswer: question.answer,
    correct: state.answers[index] === question.answer
  }));

  const score = questionResults.filter((item) => item.correct).length;
  const durationSeconds = Math.max(1, Math.round((Date.now() - state.startedAt) / 1000));
  const attemptNumber = updateProgress(exercise.id, score, exercise.questions.length);
  const submittedAt = new Date().toISOString();
  const submissionId = createSubmissionId();

  state.currentResult = {
    submissionId,
    submittedAt,
    classCode: state.selectedClass,
    studentId: state.selectedStudent,
    setId: set.id,
    setNumber: set.number,
    setTitle: set.title,
    exerciseId: exercise.id,
    exerciseTitle: exercise.title,
    exerciseVersion: exercise.version,
    score,
    total: exercise.questions.length,
    percentage: Math.round((score / exercise.questions.length) * 100),
    attemptNumber,
    durationSeconds,
    answers: questionResults
  };

  saveAttemptLocally(state.currentResult);
  state.view = "results";
  render();
  sendResultToBackend(state.currentResult);
}

function renderResults() {
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
          <button class="btn btn-ghost" id="download-result">Download TXT</button>
        </div>
        ${nextExercise ? "" : `<p class="footer-note">More exercises for this set will appear automatically after they are added and enabled in exercises.json.</p>`}
      </section>
    </main>`;

  bindIdentityTopbar();

  document.getElementById("retry-exercise").addEventListener("click", () => startExercise(set.id, exercise.id));
  document.getElementById("back-top").addEventListener("click", () => {
    state.view = "dashboard";
    render();
  });
  document.getElementById("download-result").addEventListener("click", () => downloadResultTxt(result));

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
  const [before, after] = item.sentence.split("___");
  return `
    <article class="question-card ${item.correct ? "correct" : "incorrect"}">
      <p class="question-english">
        <span class="question-number">${item.questionNumber}</span>
        ${escapeHtml(before)}<strong>${escapeHtml(item.correctAnswer)}</strong>${escapeHtml(after)}
      </p>
      <p class="question-japanese" lang="ja">${escapeHtml(item.japanese)}</p>
      <div class="answer-feedback ${item.correct ? "correct" : "incorrect"}">
        ${item.correct
          ? `✓ Correct: <strong>${escapeHtml(item.correctAnswer)}</strong>`
          : `✗ Your answer: <strong>${escapeHtml(item.studentAnswer)}</strong><br>Correct answer: <strong>${escapeHtml(item.correctAnswer)}</strong>`}
      </div>
    </article>`;
}

async function sendResultToBackend(result) {
  const status = document.getElementById("submission-status");

  if (config.demoMode || !config.submissionEndpoint) {
    if (status) {
      status.className = "submission-status message info";
      status.innerHTML = "Saved on this device. Google Sheets reporting will become active after the Apps Script endpoint is connected.";
    }
    queuePendingSubmission(result);
    return;
  }

  try {
    const response = await fetch(config.submissionEndpoint, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "submitResult", payload: result })
    });
    if (!response.ok) throw new Error("Submission request failed.");
    const outcome = await response.json();
    if (!outcome || outcome.success !== true) throw new Error(outcome?.message || "Submission was not accepted.");
    removePendingSubmission(result.submissionId);
    if (status) {
      status.className = "submission-status message success";
      status.textContent = "Result submitted successfully.";
    }
  } catch (error) {
    console.error(error);
    queuePendingSubmission(result);
    if (status) {
      status.className = "submission-status message error";
      status.textContent = "The online submission could not be completed. A copy is saved on this device and can be retried later.";
    }
  }
}

async function flushPendingSubmissions() {
  if (config.demoMode || !config.submissionEndpoint) return;
  const pending = getStorageArray(PENDING_KEY);
  if (!pending.length) return;

  for (const result of pending.slice()) {
    try {
      const response = await fetch(config.submissionEndpoint, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "submitResult", payload: result })
      });
      if (!response.ok) continue;
      const outcome = await response.json();
      if (outcome && outcome.success === true) removePendingSubmission(result.submissionId);
    } catch (error) {
      console.warn("Pending submission could not be sent", error);
      break;
    }
  }
}

function downloadResultTxt(result) {
  const lines = [
    state.data.appTitle,
    "",
    `Class: ${result.classCode}`,
    `Student ID: ${result.studentId}`,
    `Set: ${result.setNumber} - ${result.setTitle}`,
    `Exercise: ${result.exerciseTitle}`,
    `Version: ${result.exerciseVersion}`,
    `Score: ${result.score}/${result.total} (${result.percentage}%)`,
    `Attempt: ${result.attemptNumber}`,
    `Duration: ${formatDuration(result.durationSeconds)}`,
    `Submitted: ${formatDateTime(result.submittedAt)}`,
    "",
    "Answers",
    "-------"
  ];

  result.answers.forEach((item) => {
    lines.push(`${item.questionNumber}. ${item.sentence.replace("___", item.correctAnswer)}`);
    lines.push(`   Japanese: ${item.japanese}`);
    lines.push(`   Your answer: ${item.studentAnswer}`);
    lines.push(`   Correct answer: ${item.correctAnswer}`);
    lines.push(`   Result: ${item.correct ? "Correct" : "Incorrect"}`);
    lines.push("");
  });

  const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${result.classCode}_${result.studentId}_${result.exerciseId}_${result.score}-${result.total}.txt`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function renderIdentityTopbar() {
  return `
    <div class="topbar">
      <div class="topbar-left">
        <span class="identity-chip">Class: ${escapeHtml(state.selectedClass)}</span>
        <span class="identity-chip">Student: ${escapeHtml(state.selectedStudent)}</span>
      </div>
      <div class="topbar-right">
        <button class="btn btn-ghost" id="switch-student">Switch Student</button>
        <button class="btn btn-ghost" id="switch-class">Switch Class</button>
      </div>
    </div>`;
}

function bindIdentityTopbar() {
  document.getElementById("switch-student")?.addEventListener("click", () => {
    state.selectedStudent = null;
    state.currentResult = null;
    sessionStorage.removeItem(SESSION_KEY);
    state.view = "studentSelect";
    render();
  });

  document.getElementById("switch-class")?.addEventListener("click", () => {
    clearSessionState();
    state.view = "classSelect";
    render();
  });
}

function clearSessionState() {
  sessionStorage.removeItem(SESSION_KEY);
  state.selectedClass = null;
  state.selectedStudent = null;
  state.currentSetId = null;
  state.currentExerciseId = null;
  state.currentResult = null;
  state.answers = [];
}

function saveSession() {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({
    classId: state.selectedClass,
    studentId: state.selectedStudent
  }));
}

function updateProgress(exerciseId, score, total) {
  const allProgress = getStorageObject(PROGRESS_KEY);
  const studentKey = getStudentStorageKey();
  const studentProgress = allProgress[studentKey] || {};
  const existing = studentProgress[exerciseId] || {
    bestScore: 0,
    total,
    attempts: 0,
    lastScore: 0,
    lastAttemptAt: null
  };

  const attemptNumber = existing.attempts + 1;
  studentProgress[exerciseId] = {
    bestScore: Math.max(existing.bestScore, score),
    total,
    attempts: attemptNumber,
    lastScore: score,
    lastAttemptAt: new Date().toISOString()
  };
  allProgress[studentKey] = studentProgress;
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(allProgress));
  return attemptNumber;
}

function getCurrentStudentProgress() {
  const allProgress = getStorageObject(PROGRESS_KEY);
  return allProgress[getStudentStorageKey()] || {};
}

function saveAttemptLocally(result) {
  const attempts = getStorageArray(ATTEMPTS_KEY);
  attempts.push(result);
  localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(attempts.slice(-250)));
}

function queuePendingSubmission(result) {
  const pending = getStorageArray(PENDING_KEY);
  if (!pending.some((item) => item.submissionId === result.submissionId)) {
    pending.push(result);
    localStorage.setItem(PENDING_KEY, JSON.stringify(pending.slice(-250)));
  }
}

function removePendingSubmission(submissionId) {
  const pending = getStorageArray(PENDING_KEY).filter((item) => item.submissionId !== submissionId);
  localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
}

function getStorageObject(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "{}") || {};
  } catch (error) {
    console.warn(`Invalid local storage data for ${key}`, error);
    return {};
  }
}

function getStorageArray(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch (error) {
    console.warn(`Invalid local storage data for ${key}`, error);
    return [];
  }
}

function getStudentStorageKey() {
  return `${state.selectedClass}:${state.selectedStudent}`;
}

function getClass(classId) {
  const result = state.data.classes.find((item) => item.id === classId);
  if (!result) throw new Error(`Class not found: ${classId}`);
  return result;
}

function getSet(setId) {
  const result = state.data.sets.find((item) => item.id === setId);
  if (!result) throw new Error(`Set not found: ${setId}`);
  return result;
}

function getExercise(set, exerciseId) {
  const result = set.exercises.find((item) => item.id === exerciseId);
  if (!result) throw new Error(`Exercise not found: ${exerciseId}`);
  return result;
}

function findNextEnabledExercise(set, exerciseId) {
  const index = set.exercises.findIndex((item) => item.id === exerciseId);
  return set.exercises.slice(index + 1).find((item) => item.enabled) || null;
}

function getStudentIds(classInfo) {
  const result = [];
  for (let number = classInfo.studentIdStart; number <= classInfo.studentIdEnd; number += 1) {
    result.push(`${classInfo.studentIdPrefix}${String(number).padStart(3, "0")}`);
  }
  return result;
}

function isValidStudentId(classId, studentId) {
  try {
    return getStudentIds(getClass(classId)).includes(studentId);
  } catch {
    return false;
  }
}

function getStars(score) {
  if (!Number.isFinite(score)) return 0;
  const thresholds = config.scoreThresholds || { threeStars: 13, twoStars: 10, oneStar: 7 };
  if (score >= thresholds.threeStars) return 3;
  if (score >= thresholds.twoStars) return 2;
  if (score >= thresholds.oneStar) return 1;
  return 0;
}

function renderStars(score) {
  const filled = getStars(score);
  return `${"★".repeat(filled)}${"☆".repeat(3 - filled)}`;
}

function createSubmissionId() {
  const random = Math.random().toString(36).slice(2, 9);
  return `${state.selectedClass}-${state.selectedStudent}-${Date.now()}-${random}`;
}

function formatDuration(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}:${String(remaining).padStart(2, "0")}`;
}

function formatDateTime(isoString) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date(isoString));
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
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
  return escapeHtml(value);
}
