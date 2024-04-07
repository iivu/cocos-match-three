import * as cc from 'cc';

import * as Constants from './Constants';
import * as Events from './Events';
import * as Utils from './Utils';

const { ccclass, property } = cc._decorator;

@ccclass('CandyManager')
export class CandyManager extends cc.Component {
  private _startLocation = new cc.Vec2();
  private _currentLocation = new cc.Vec2();

  protected start(): void {
    this.node.on(cc.Input.EventType.TOUCH_START, this._touchStart, this);
    this.node.on(cc.Input.EventType.TOUCH_MOVE, this._touchMove, this);
  }

  protected onDestroy(): void {
    this.node.off(cc.Input.EventType.TOUCH_START, this._touchStart, this);
    this.node.off(cc.Input.EventType.TOUCH_MOVE, this._touchMove, this);
  }

  private _touchStart(event: cc.EventTouch) {
    const touch = event.getTouches()[0];
    touch.getLocation(this._startLocation);
    touch.getLocation(this._currentLocation);
    this.node.dispatchEvent(new Events.CustomEvent(Events.EVENT_CANDY_CLICK, { node: this.node }));
  }

  private _touchMove(event: cc.EventTouch) {
    const touch = event.getTouches()[0];
    touch.getStartLocation(this._startLocation);
    touch.getLocation(this._currentLocation);
    const distance = cc.Vec2.distance(this._startLocation, this._currentLocation);
    if (distance > Constants.MIN_TOUCH_MOVE_DISTANCE) {
      this.node.dispatchEvent(
        new Events.CustomEvent(Events.EVENT_CANDY_MOVE, {
          node: this.node,
          direction: Utils.getTouchDirection(this._startLocation, this._currentLocation),
        })
      );
    }
  }
}
