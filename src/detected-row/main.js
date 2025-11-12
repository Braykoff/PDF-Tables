"use-strict";

import { DetectedRowPage } from "./page.js";
import { runBaseApp } from "../shared/base-main.js";

/** Referenced HTML DOM elements. */
const dom = Object.freeze({
  detectRowsButton: document.getElementById("detectRowsAction")
});

// Current app state
const state = {
  currentPage: -1,
  pages: [],
  textBoxesShown: false
};

// When detect rows button pressed, detect rows
dom.detectRowsButton.addEventListener("click", () => {
  for (const p of state.pages) {
    p.detectRows();
  }
});

// Run base app functionality 
runBaseApp(DetectedRowPage, state, () => undefined);
