/*
  Public app configuration.
  The class passkeys are stored only as SHA-256 hashes. This avoids Google
  multi-account routing problems during passkey entry. Result submissions still
  go to the private Google Apps Script spreadsheet receiver.
*/
window.APP_CONFIG = {
  demoMode: false,
  submissionEndpoint: "https://script.google.com/macros/s/AKfycbzqt8iuNGciqXZLHrJvcCvpLWp1K3ZdSqgIUXKrrBChw16m55X3VTuXcrriQgz3W04H/exec",
  customGptUrl: "",
  customGptButtonLabel: "アウトプット練習へGO!",
  passkeyHashes: {
    EAP: "ffce93a2de5c12579a3c91ac520b77530a5d5394d129b21e9453c35b931c65a6",
    FL: "b45027960e54c915239ab41217df5c6b54daaa533617f6976df9ebb42a5be578"
  },
  scoreThresholds: {
    threeStars: 13,
    twoStars: 10,
    oneStar: 7
  }
};
