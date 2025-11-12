"use-strict";

import { FixedRowPage } from "./page.js";
import { runBaseApp } from "../shared/base-main.js";
import { DEFAULT_ROWS } from "./constants.js";

/** Referenced HTML DOM elements. */
const dom = Object.freeze({
  fileInput: document.getElementById("fileInput"),
  rowEntry: document.getElementById("rowEntry")
});

// Current app state
const state = {
  currentPage: -1,
  pages: [],
  textBoxesShown: false
};

// Update row input on new file
dom.fileInput.addEventListener("change", () => {
  dom.rowEntry.value = DEFAULT_ROWS;
});

// Update row input value when scrolling
function updateRowInput(page) {
  dom.rowEntry.value = page.rowCount;
}

// When row input is changed, validate input and update table
dom.rowEntry.addEventListener("change", () => {
  const page = state.pages[state.currentPage - 1];
  if (page === undefined) return;

  const clampedRows = page.setRowCount(dom.rowEntry.value);
  dom.rowEntry.value = clampedRows;
});

// Run base app functionality 
runBaseApp(FixedRowPage, state, updateRowInput);
