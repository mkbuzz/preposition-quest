# Preposition Quest

A responsive, data-driven preposition practice app designed for GitHub Pages.

## Included now

- Class selection: EAP or FL
- Four-digit numeric passkey screen
- Student IDs:
  - EAP: E001–E022
  - FL: F001–F021
- Six preposition sets
- One active 15-question exercise per set
- Two disabled “Coming soon” exercise slots per set
- Clickable word bank
- Automatic movement to the next unanswered sentence
- Word bank that remains visible:
  - wide screens: sticky side panel
  - medium screens: sticky top panel
  - smartphones: fixed bottom panel
- Scoring and answer review
- Retry, next exercise, next set, and top-page navigation
- Per-student progress stored in the current browser
- Downloadable TXT result receipt
- Google Apps Script connection points for secure passkey validation and Google Sheets submissions

## Important security note

`config.js` currently has `demoMode: true`, which places the temporary EAP and FL passkeys in a public JavaScript file. This is suitable only for private testing.

Before publishing the app to students:

1. Deploy the Google Apps Script receiving endpoint.
2. Put its URL in `submissionEndpoint` in `config.js`.
3. Change `demoMode` to `false`.
4. Remove `demoPasskeys` from `config.js` if desired.

## Testing locally

Because the app loads `data/exercises.json`, do not double-click `index.html` directly. Start a local web server from the project folder.

For example:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## GitHub Pages

Upload the contents of this folder to a GitHub repository. In the repository settings, enable GitHub Pages using the branch and root folder that contain `index.html`.

## Adding or replacing exercises

Edit:

```text
data/exercises.json
```

Each set contains an `exercises` array. An exercise becomes available when:

- `enabled` is `true`
- `questions` contains valid question objects
- every sentence contains exactly one `___`
- every answer is included in that set’s `wordBank`

Example:

```json
{
  "id": "set1-ex2",
  "title": "Exercise 2",
  "version": "2026-08-01-1",
  "enabled": true,
  "questions": [
    {
      "id": "set1-ex2-q1",
      "sentence": "The meeting starts ___ noon.",
      "answer": "at",
      "japanese": "会議は正午に始まる。"
    }
  ]
}
```

The app generates the exercise buttons automatically. You can add Exercise 4, Exercise 5, or additional sets without changing `index.html`.

Keep each published exercise ID stable. Changing an ID causes the browser to treat it as a different exercise, so previous locally saved scores will no longer appear under the renamed exercise.

## Google Sheets connection

The front end is prepared to send two request types to the Apps Script URL:

### Passkey validation

```json
{
  "action": "validateClass",
  "classCode": "EAP",
  "passkey": "0174"
}
```

Expected response:

```json
{
  "success": true
}
```

### Result submission

```json
{
  "action": "submitResult",
  "payload": {
    "submissionId": "...",
    "classCode": "EAP",
    "studentId": "E001",
    "setId": "set1",
    "exerciseId": "set1-ex1",
    "score": 12,
    "total": 15,
    "answers": []
  }
}
```

Expected response:

```json
{
  "success": true
}
```

Until the endpoint is connected, results are stored only in the student’s browser and can be downloaded as TXT files.
