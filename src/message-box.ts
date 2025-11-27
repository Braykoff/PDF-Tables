/** The duration to show a temporary message for, milliseconds. */
const MESSAGE_DURATION: number = 400;

/** The message box's fade out time and style. */
const MESSAGE_ANIMATION: string = "0.8s linear";

/**
 * Represents the current state of the Message Box.
 */
export enum MessageBoxState { HIDDEN, SHOWN_PERMANENT, SHOWN_TEMPORARY }

/**
 * Handles the message box in the lower left corner.
 */
export class MessageBox {
  // MARK: Construction
  // HTML elements
  private _container: HTMLDivElement;
  private _content: HTMLSpanElement;

  // State
  private _state: MessageBoxState = MessageBoxState.HIDDEN;
  private _fadeTimeout: NodeJS.Timeout | undefined = undefined;

  /**
   * Constructs a new message box, for handling the prompts in the lower left corner.
   * @param container The message box's container element.
   * @param content The message box's content element.
   */
  constructor(container: HTMLDivElement, content: HTMLSpanElement) { 
    this._container = container;
    this._content = content;
  }

  // MARK: State
  /**
   * Fade out the current textbox. Set this on a timeout.
   */
  private _fadeOut(): void {
    this._container.style.transition = `opacity ${MESSAGE_ANIMATION}`;
    this._container.style.opacity = "0.0";
    this._state = MessageBoxState.HIDDEN;
  }

  /**
   * Resets the style to 100% shown, no transition.
   */
  private _resetStyle(): void {
    this._container.style.visibility = "visible";
    this._container.style.transition = "";
    this._container.style.opacity = "0.6";
  }

  /**
   * Show a message until cleared with .hide().
   * @param msg The message to show.
   */
  showPermanentText(msg: string): void {
    clearTimeout(this._fadeTimeout);

    this._content.innerText = msg;
    this._resetStyle();
    this._state = MessageBoxState.SHOWN_PERMANENT;
  }

  /**
   * Show a temporary message that will fade out.
   * @param msg The message to show.
   * @param duration (Optional) The duration to show the message for, 
   * milliseconds.
   */
  showTempText(msg: string, duration: number = MESSAGE_DURATION): void {
    clearTimeout(this._fadeTimeout);

    this._content.innerText = msg;
    this._resetStyle();
    this._state = MessageBoxState.SHOWN_TEMPORARY;

    this._fadeTimeout = setTimeout(this._fadeOut.bind(this), duration);
  }

  /**
   * Immediately hide the textbox.
   */
  hide(): void {
    clearTimeout(this._fadeTimeout);
    this._container.style.visibility = "hidden";
    this._state = MessageBoxState.HIDDEN;
  }

  // MARK: Getters
  /**
   * @returns The current state.
   */
  get state(): MessageBoxState {
    return this._state;
  }
}