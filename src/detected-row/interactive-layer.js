import { NORMAL_TABLE_BORDER_COLOR, TABLE_SCALE_FACTOR } from "../shared/constants";
import { InteractiveLayer } from "../shared/interactive-layer";
import { LABEL_FONT_SIZE, LABEL_VERTICAL_PADDING } from "./constants";

/**
 * 
 * @param {*} size 
 * @param {*} text 
 * @returns 
 */
function fontSizeToWidth(size, textLength) {
  return size * 0.6 * textLength;
}

function fontSizeToHeight(size) {
  return 0.75 * size;
}

export class DetectedRowInteractiveLayer extends InteractiveLayer {
  redraw() {
    super.redraw();

    // Get sizing for column label
    let width = this.page.getColWidth(0);
    let msg;

    if (fontSizeToWidth(LABEL_FONT_SIZE, 5) <= width - 4) {
      msg = "INDEX";
    } else if (fontSizeToWidth(LABEL_FONT_SIZE, 3) <= width - 4) {
      msg = "IDX";
    } else if (fontSizeToWidth(LABEL_FONT_SIZE, 1) <= width - 4) {
      msg = "I";
    } else {
      msg = undefined;
    }

    // Add index column label
    this.context.fillStyle = NORMAL_TABLE_BORDER_COLOR;
    this.context.fillRect(
      this.page.tableX * TABLE_SCALE_FACTOR,
      (this.page.tableY - fontSizeToHeight(LABEL_FONT_SIZE) - LABEL_VERTICAL_PADDING) * TABLE_SCALE_FACTOR,
      width * TABLE_SCALE_FACTOR,
      (fontSizeToHeight(LABEL_FONT_SIZE) + LABEL_VERTICAL_PADDING) * TABLE_SCALE_FACTOR
    );

    if (msg !== undefined) {
      this.context.font = `bold ${LABEL_FONT_SIZE * TABLE_SCALE_FACTOR}px Courier New`;
      this.context.fillStyle = "white";

      this.context.fillText(
        msg,
        (this.page.tableX + (width - fontSizeToWidth(LABEL_FONT_SIZE, msg.length)) / 2) * TABLE_SCALE_FACTOR,
        (this.page.tableY - LABEL_VERTICAL_PADDING / 2) * TABLE_SCALE_FACTOR
      );
    }
  }
}