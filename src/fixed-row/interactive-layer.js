import { BaseInteractiveLayer } from "../shared/base-interactive-layer.js";

/**
 * Represents the interactive layer of PDF page for fixed row mode.
 */
export class FixedRowInteractiveLayer extends BaseInteractiveLayer {
  onVerticalDrag() {
    // There is no custom functionality required for the fixed row interactive layer.
    // This is here for parallelism with the detected row mode.
  }
}
