/*
  IMPORTANT:
  Demo mode keeps the temporary class passkeys in this public file so the app can
  be tested before Google Apps Script is connected. Do not publish this version
  for student use. After the Apps Script endpoint is ready:
    1. Set demoMode to false.
    2. Enter the deployed Apps Script URL in submissionEndpoint.
    3. Remove the demoPasskeys object if desired.
*/
window.APP_CONFIG = {
  demoMode: true,
  submissionEndpoint: "",
  demoPasskeys: {
    EAP: "1111",
    FL: "2222"
  },
  scoreThresholds: {
    threeStars: 13,
    twoStars: 10,
    oneStar: 7
  }
};
