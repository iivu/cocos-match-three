import * as cc from 'cc';

export const EVENT_CANDY_CLICK = 'candy-click';
export const EVENT_CANDY_MOVE = 'candy-move';

export class CustomEvent<T> extends cc.Event {
  public detail: T = null;

  constructor(eventName: string, detail: T = null, bubbles: boolean = true) {
    super(eventName, bubbles);
    this.detail = detail;
  }
}
