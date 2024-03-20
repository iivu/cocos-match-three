import * as cc from 'cc';
const { ccclass, property } = cc._decorator;

@ccclass('CandyManager')
export class CandyManager extends cc.Component {
  private _row = 0;
  private _column = 0;

  protected start() {
    this.node.on(cc.Input.EventType.TOUCH_START, this._touchStart, this);
    this.node.on(cc.Input.EventType.TOUCH_MOVE, this._touchMove, this);
    this.node.on(cc.Input.EventType.TOUCH_END, this._touchEnd, this);
  }

  protected update(deltaTime: number) {}

  protected onDestroy(): void {
    this.node.off(cc.Input.EventType.TOUCH_START, this._touchStart, this);
    this.node.off(cc.Input.EventType.TOUCH_MOVE, this._touchMove, this);
    this.node.off(cc.Input.EventType.TOUCH_END, this._touchEnd, this);
  }

  private _touchStart(event: cc.EventTouch) {
    console.log('touch start')
  }
  private _touchMove(event: cc.EventTouch) {
    console.log('touch move')
  }
  private _touchEnd(event: cc.EventTouch) {
    console.log('touch end')
  }

  public setRowAndColum(r: number, c: number) {
    this._row = r;
    this._column = c;
  }
}
