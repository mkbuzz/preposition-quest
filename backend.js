"use strict";

/*
  Google Apps Script bridge for GitHub Pages.

  Passkeys are checked locally against SHA-256 hashes so Google multi-account
  routing cannot block class entry. Exercise results are still sent to the
  private Google Apps Script receiver and confirmed by submission ID.
*/

(() => {
  const originalSendResultToBackend = window.sendResultToBackend;
  const originalFlushPendingSubmissions = window.flushPendingSubmissions;

  window.validateClassPasskey = async function validateClassPasskeyConnected(classId, passkey) {
    const expectedHash = config.passkeyHashes && config.passkeyHashes[classId];
    if (!expectedHash) {
      throw new Error("No passkey hash is configured for this class.");
    }

    const actualHash = await sha256(`prepositionQuest:${classId}:${passkey}`);
    return actualHash === expectedHash;
  };

  window.sendResultToBackend = async function sendResultToBackendConnected(result) {
    const status = document.getElementById("submission-status");

    if (!config.submissionEndpoint) {
      return originalSendResultToBackend(result);
    }

    queuePendingSubmission(result);

    try {
      await postResultNoCors(result);
      const recorded = await waitForSubmissionRecord(result.submissionId);
      if (!recorded) {
        throw new Error("The server did not confirm the submission.");
      }

      removePendingSubmission(result.submissionId);
      if (status) {
        status.className = "submission-status message success";
        status.textContent = "Result submitted successfully.";
      }
    } catch (error) {
      console.error(error);
      if (status) {
        status.className = "submission-status message error";
        status.textContent = "The online submission could not be confirmed. A copy is saved on this device and will be retried automatically.";
      }
    }
  };

  window.flushPendingSubmissions = async function flushPendingSubmissionsConnected() {
    if (!config.submissionEndpoint) {
      return originalFlushPendingSubmissions();
    }

    const pending = getStorageArray(PENDING_KEY);
    if (!pending.length) return;

    for (const result of pending.slice()) {
      try {
        const alreadyRecorded = await checkSubmissionRecord(result.submissionId);
        if (alreadyRecorded) {
          removePendingSubmission(result.submissionId);
          continue;
        }

        await postResultNoCors(result);
        const recorded = await waitForSubmissionRecord(result.submissionId, 5, 900);
        if (recorded) {
          removePendingSubmission(result.submissionId);
        } else {
          break;
        }
      } catch (error) {
        console.warn("Pending submission could not be sent", error);
        break;
      }
    }
  };

  async function postResultNoCors(result) {
    await fetch(config.submissionEndpoint, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "submitResult", payload: result })
    });
  }

  async function checkSubmissionRecord(submissionId) {
    const outcome = await jsonpRequest(config.submissionEndpoint, {
      action: "checkSubmission",
      submissionId
    });

    return Boolean(
      outcome &&
      outcome.success === true &&
      outcome.recorded === true
    );
  }

  async function waitForSubmissionRecord(submissionId, attempts = 8, delayMilliseconds = 800) {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      if (attempt > 0) await wait(delayMilliseconds);

      try {
        if (await checkSubmissionRecord(submissionId)) return true;
      } catch (error) {
        console.warn("Submission confirmation check failed", error);
      }
    }

    return false;
  }

  async function sha256(text) {
    const data = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  function jsonpRequest(endpoint, parameters, timeoutMilliseconds = 10000) {
    return new Promise((resolve, reject) => {
      const callbackName = `__pqJsonp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const url = new URL(endpoint);

      Object.entries(parameters).forEach(([key, value]) => {
        url.searchParams.set(key, String(value));
      });
      url.searchParams.set("callback", callbackName);
      url.searchParams.set("_", String(Date.now()));

      const script = document.createElement("script");
      let timeoutId;

      const cleanup = () => {
        clearTimeout(timeoutId);
        script.remove();
        try {
          delete window[callbackName];
        } catch {
          window[callbackName] = undefined;
        }
      };

      window[callbackName] = (data) => {
        cleanup();
        resolve(data);
      };

      script.onerror = () => {
        cleanup();
        reject(new Error("The Google Apps Script request failed."));
      };

      timeoutId = window.setTimeout(() => {
        cleanup();
        reject(new Error("The Google Apps Script request timed out."));
      }, timeoutMilliseconds);

      script.src = url.toString();
      script.async = true;
      script.referrerPolicy = "no-referrer";
      document.head.appendChild(script);
    });
  }
})();
