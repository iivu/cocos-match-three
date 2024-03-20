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

type CandyData = { state: CandyState; type: string; ins: cc.Node };
// type CandyName = 'Candy_01' | 'Candy_02' | 'Candy_03' | 'Candy_04' | 'Candy_05' | 'Candy_06'

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

  private _boardWidth = Constants.BOARD_COL * Constants.CANDY_WIDTH;
  private _boardHeight = Constants.BOARD_ROW * Constants.CANDY_HEIGHT;
  private _candyData: CandyData[][] = [];
  private _candyNameToPrefabMap: Record<string, cc.Prefab> = {};
  private _candyTypes: string[] = [];
  private _isSwitching = false;
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
        candy.ins = ins;
        ins.position = new cc.Vec3(
          -this._boardWidth / 2 + Constants.CANDY_WIDTH / 2 + rowIndex * Constants.CANDY_WIDTH,
          -this._boardHeight / 2 + Constants.CANDY_HEIGHT / 2 + colIndex * Constants.CANDY_HEIGHT,
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
    event.getLocation(this._touchLocation);
    for (let row = 0; row < Constants.BOARD_ROW; row++) {
      for (let col = 0; col < Constants.BOARD_COL; col++) {
        if (this._getCandy(row, col).ins.getComponent(cc.UITransform).getBoundingBoxToWorld().contains(this._touchLocation)) {
          this._isSwitching = true;
          this._targetCandyRC.x = row;
          this._targetCandyRC.y = col;
          break;
        }
      }
    }
  }

  private _touchMove(event: cc.EventTouch) {
    if (!this._isSwitching) return;
  }

  private _touchEnd(event: cc.EventTouch) {}

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
}
