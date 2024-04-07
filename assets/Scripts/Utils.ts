import * as cc from 'cc';

import * as Types from './Types';

export function getTouchDirection(start: cc.Vec2, end: cc.Vec2): Types.Direction {
  const deltaX = cc.bits.abs(start.x - end.x);
  const deltaY = cc.bits.abs(start.y - end.y);
  if (deltaX > deltaY) {
    if (end.x > start.x) return Types.Direction.RIGHT;
    else return Types.Direction.LEFT;
  } else {
    if (end.y > start.y) return Types.Direction.UP;
    else return Types.Direction.DOWN;
  }
}

export function sleep(t: number = 100) {
  return new Promise(r => setTimeout(r, t));
}
