import * as cc from 'cc';
import * as Constants from './Constants';

const { ccclass, property } = cc._decorator;

enum CandyState {
  NORMAL = 1,
  MOVE = 2,
  PRECANCEL1 = 3,
  PRECANCEL2 = 4,
  CANCEL = 5,
  CANCELED = 6,
}
enum Direction {
  UP,
  DOWN,
  LEFT,
  RIGHT,
}

type CandyData = { state: CandyState; type: string; ins: cc.Node };

@ccclass('GameManager')
export class GameManager extends cc.Component {
  @property(cc.Node)
  scoreText: cc.Label = null;
  @property(cc.Node)
  soundManager: cc.Node = null;
  @property(cc.Node)
  board: cc.Node = null;
  @property({ type: [cc.Prefab] })
  candyPrefabs: cc.Prefab[] = [];

  private _boardWidth = 0;
  private _boardHeight = 0;
  private _candySize = 0;
  private _candyData: CandyData[][] = [];
  private _candyNameToPrefabMap: Record<string, cc.Prefab> = {};
  private _candyTypes: string[] = [];
  private _isTouching = false;
  private _isChecking = false;
  private _touchLocation = new cc.Vec2(0, 0);
  private _targetCandyRC: cc.Vec2 | null = null;

  protected start() {
    this._initGameData();
    this._initBoard();
    this._initEvent();
  }

  protected update(deltaTime: number) {}

  protected onDestroy(): void {
    this._offEvent();
  }

  private _initGameData() {
    this._boardWidth = this.board.getComponent(cc.UITransform).contentSize.width;
    this._candySize = this._boardWidth / Constants.BOARD_COL;
    this._boardHeight = this._candySize * Constants.BOARD_ROW;
    this._candyTypes = this.candyPrefabs.map(p => {
      this._candyNameToPrefabMap[p.name] = p;
      return p.name;
    });
    this._candyData = [];
    for (let row = 0; row < Constants.BOARD_ROW; row++) {
      this._candyData.push([]);
      for (let col = 0; col < Constants.BOARD_COL; col++) {
        this._candyData[row][col] = { state: CandyState.NORMAL, type: this._randomGenerateCandyType(row, col), ins: null };
      }
    }
  }

  private _initBoard() {
    this._candyData.forEach((row, rowIndex) =>
      row.forEach((candy, colIndex) => {
        const ins = cc.instantiate(this._candyNameToPrefabMap[candy.type]);
        const ui = ins.getComponent(cc.UITransform);
        ui.contentSize = new cc.Size(this._candySize, this._candySize);
        candy.ins = ins;
        ins.position = new cc.Vec3(
          -this._boardWidth / 2 + this._candySize / 2 + colIndex * this._candySize,
          this._boardHeight / 2 - this._candySize / 2 - rowIndex * this._candySize,
          0
        );
        this.board.addChild(ins);
      })
    );
  }

  private _initEvent() {
    cc.input.on(cc.Input.EventType.TOUCH_START, this._touchStart, this);
    cc.input.on(cc.Input.EventType.TOUCH_MOVE, this._touchMove, this);
    cc.input.on(cc.Input.EventType.TOUCH_END, this._touchEnd, this);
  }

  private _offEvent() {
    cc.input.off(cc.Input.EventType.TOUCH_START, this._touchStart, this);
    cc.input.off(cc.Input.EventType.TOUCH_MOVE, this._touchMove, this);
    cc.input.off(cc.Input.EventType.TOUCH_END, this._touchEnd, this);
  }

  private _touchStart(event: cc.EventTouch) {
    event.getUILocation(this._touchLocation);
    for (let row = 0; row < Constants.BOARD_ROW; row++) {
      for (let col = 0; col < Constants.BOARD_COL; col++) {
        const candy = this._getCandy(row, col);
        if (candy.ins.getComponent(cc.UITransform).getBoundingBoxToWorld().contains(this._touchLocation)) {
          this._isTouching = true;
          this._targetCandyRC = new cc.Vec2(0, 0);
          this._targetCandyRC.x = row;
          this._targetCandyRC.y = col;
          cc.tween(candy.ins).to(.3, { scale: new cc.Vec3(1.2, 1.2, 0) }, { easing: cc.easing.backInOut }).start();
          break;
        }
      }
    }
  }

  private _touchMove(event: cc.EventTouch) {
    if (!this._isTouching) return;
    const startLocation = event.getStartLocation();
    const currLocation = event.getLocation();
    const distance = cc.Vec2.distance(startLocation, currLocation);
    if (distance > Constants.MIN_TOUCH_MOVE_DISTANCE && !this._isChecking) {
      this._isChecking = true;
      const direction = this._getTouchDirection(startLocation, currLocation);
    }
  }

  private _touchEnd(event: cc.EventTouch) {
    this._isTouching = false;
  }

  private _exchangeCandy(candy1: cc.Vec2, candy2: cc.Vec2) {}

  private _exchangeCandyByDirection(candy: cc.Vec2, direction: Direction) {}

  private _randomGenerateCandyType(row: number, col: number): string {
    const canUseTypes = this._candyTypes.filter(type => {
      let aboveOk = true;
      let leftOk = true;
      if (row > 0) {
        const aboveCandy = this._getCandy(row - 1, col);
        aboveOk = aboveCandy.type !== type;
      }
      if (col > 0) {
        const leftCandy = this._getCandy(row, col - 1);
        leftOk = leftCandy.type !== type;
      }
      return aboveOk && leftOk;
    });
    return canUseTypes[cc.randomRangeInt(0, canUseTypes.length)];
  }

  private _getCandy(row: number, col: number): CandyData {
    return this._candyData[row][col];
  }

  private _getTouchDirection(start: cc.Vec2, end: cc.Vec2): Direction {
    const deltaX = cc.bits.abs(start.x - end.x);
    const deltaY = cc.bits.abs(start.y - end.y);
    if (deltaX > deltaY) {
      if (end.x > start.x) return Direction.RIGHT;
      else return Direction.LEFT;
    } else {
      if (end.y > start.y) return Direction.UP;
      else return Direction.DOWN;
    }
  }
}
