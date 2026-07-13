/*
  Public app configuration.
  The real class passkeys are stored in Google Apps Script properties, not here.
*/
window.APP_CONFIG = {
  demoMode: false,
  submissionEndpoint: "https://script.google.com/macros/s/AKfycbzqt8iuNGciqXZLHrJvcCvpLWp1K3ZdSqgIUXKrrBChw16m55X3VTuXcrriQgz3W04H/exec",
  scoreThresholds: {
    threeStars: 13,
    twoStars: 10,
    oneStar: 7
  }
};
