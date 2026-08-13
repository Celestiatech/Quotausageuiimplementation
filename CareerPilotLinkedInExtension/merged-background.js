"use strict";
// MERGED SERVICE WORKER: CareerPilotLinkedInExtension + LiftMyCV
console.log("MERGED SERVICE WORKER");

// Some bundled third-party scripts call chrome.tabs.sendMessage / chrome.runtime.sendMessage
// as promises without .catch(). When the receiving content script is not present (tab closed,
// content script not yet injected, or another extension context absent) Chrome rejects those
// promises with "Could not establish connection. Receiving end does not exist." That is an
// expected, transient condition, so swallow it at the service worker level instead of logging
// "Uncaught (in promise)" for every background task poll.
self.addEventListener("unhandledrejection", (event) => {
  try {
    const message = String(
      (event && event.reason && (event.reason.message || event.reason)) || ""
    );
    if (
      message.includes("Could not establish connection") ||
      message.includes("Receiving end does not exist") ||
      message.includes("Extension context invalidated") ||
      message.includes("The message port closed before a response was received")
    ) {
      event.preventDefault();
      return;
    }
  } catch {
    event.preventDefault();
  }
});

importScripts('js/common.js');
importScripts('assets/background.js');
importScripts('lift-worker.js');
importScripts('career-worker.js');
