import * as cc from 'cc';

import * as Types from './Types';
import * as Constants from './Constants';
import * as Events from './Events';
import * as Utils from './Utils';

const { ccclass, property } = cc._decorator;

enum CandyState {
  NORMAL = 1,
  CANCELED = 3,
}

type CandyData = { state: CandyState; type: string; ins: cc.Node };

@ccclass('GameManager')
export class GameManager extends cc.Component {
  @property(cc.Node)
  scoreText: cc.Node = null;
  @property(cc.Node)
  soundManager: cc.Node = null;
  @property(cc.Node)
  board: cc.Node = null;
  @property({ type: [cc.Prefab] })
  candyPrefabs: cc.Prefab[] = [];

  private _score = { value: 0, animating: 0 };
  private _boardWidth = 0;
  private _boardHeight = 0;
  private _candySize = 0;
  private _candyData: CandyData[][] = [];
  private _candyNameToPrefabMap: Record<string, cc.Prefab> = {};
  private _candyTypes: string[] = [];
  private _isTouching = false;
  private _isChecking = false;
  private _touchLocation = new cc.Vec2(0, 0);
  private _targetCandyRC = new cc.Vec2(-1, -1);

  protected start() {
    this._initGameData();
    this._initBoard();
  }

  protected update(deltaTime: number) {}

  protected onDestroy(): void {}

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
        candy.ins = this._instantiateCandy(candy.type);
        this._placeCandy(rowIndex, colIndex, candy.ins);
        this.board.addChild(candy.ins);
      })
    );
    this.board.on(Events.EVENT_CANDY_CLICK, (e: Events.CustomEvent<{ node: cc.Node }>) => this._onCandyClick(e.detail.node));
    this.board.on(Events.EVENT_CANDY_MOVE, (e: Events.CustomEvent<{ node: cc.Node; direction: Types.Direction }>) =>
      this._onCandyMove(e.detail.node, e.detail.direction)
    );
  }

  private _onCandyClick(node: cc.Node) {
    if (this._isChecking) return;
    const [row, col] = this._getCandyIndexByNode(node);
    const candy = this._getCandy(row, col);
    if (candy.state === CandyState.CANCELED) return;
    if (this._targetCandyRC.x !== -1) {
      this._processMainLogic(this._targetCandyRC, new cc.Vec2(row, col));
    } else {
      this._targetCandyRC.x = row;
      this._targetCandyRC.y = col;
      cc.tween(candy.ins)
        .to(0.3, { scale: new cc.Vec3(1.2, 1.2, 1) }, { easing: cc.easing.backInOut })
        .start();
    }
  }

  private _onCandyMove(node: cc.Node, direction: Types.Direction) {
    if (this._isChecking) return;
    if (this._targetCandyRC.x === -1) return;
    const [row, col] = this._getCandyIndexByNode(node);
    this._processMainLogic(new cc.Vec2(row, col), null, direction);
  }

  private async _processMainLogic(candy1RC: cc.Vec2, candy2RC?: cc.Vec2, direction?: Types.Direction) {
    this._isChecking = true;
    // 1. process exchange
    if (!candy2RC) {
      const [_, tempCandy2RC] = await this._exchangeCandyByDirection(candy1RC, direction);
      if (!tempCandy2RC) {
        this._isChecking = false;
        this._targetCandyRC.x = this._targetCandyRC.y = -1;
        return;
      } else {
        candy2RC = tempCandy2RC;
      }
    } else {
      const exchangeOk = await this._exchangeCandy(candy1RC, candy2RC);
      if (!exchangeOk) {
        await Promise.all([
          new Promise(resolve =>
            cc
              .tween(this._getCandy(candy1RC.x, candy1RC.y).ins)
              .to(0.3, { scale: new cc.Vec3(1, 1, 1) }, { easing: cc.easing.backInOut })
              .call(resolve)
              .start()
          ),
          new Promise(resolve =>
            cc
              .tween(this._getCandy(candy2RC.x, candy2RC.y).ins)
              .to(0.3, { scale: new cc.Vec3(1.2, 1.2, 1) }, { easing: cc.easing.backInOut })
              .call(() => {
                this._targetCandyRC.x = candy2RC.x;
                this._targetCandyRC.y = candy2RC.y;
                resolve(true);
              })
              .start()
          ),
        ]);
        this._isChecking = false;
        return;
      }
    }
    // 2. process match
    let needCancelCandy = await this._checkMatch(candy1RC, candy2RC);
    if (needCancelCandy.length === 0) {
      await this._exchangeCandy(candy1RC, candy2RC);
      this._isChecking = false;
      this._targetCandyRC.x = this._targetCandyRC.y = -1;
      return;
    }
    await this._cancelCandy(needCancelCandy);
    await this._generateCandy(await this._moveCandy(-1));
    // 3. loop check
    while ((needCancelCandy = await this._checkMatch()).length !== 0) {
      await this._cancelCandy(needCancelCandy);
      await this._generateCandy(await this._moveCandy(-1));
    }
    this._isChecking = false;
    this._targetCandyRC.x = this._targetCandyRC.y = -1;
  }

  private async _exchangeCandy(candy1RC: cc.Vec2, candy2RC: cc.Vec2): Promise<boolean> {
    const { x: r1, y: c1 } = candy1RC;
    const { x: r2, y: c2 } = candy2RC;
    if (r1 !== r2 && c1 !== c2) {
      return false;
    }
    if (r1 === r2 && c1 === c2) {
      return false;
    }
    if (r1 === r2 && cc.bits.abs(c1 - c2) > 1) {
      return false;
    }
    if (c1 === c2 && cc.bits.abs(r1 - r2) > 1) {
      return false;
    }
    const candy1 = this._getCandy(r1, c1);
    const candy2 = this._getCandy(r2, c2);
    this._candyData[r1][c1] = candy2;
    this._candyData[r2][c2] = candy1;
    const exchangePromises = [
      new Promise(resolve =>
        cc
          .tween(candy1.ins)
          .to(0.1, { position: candy2.ins.position, scale: new cc.Vec3(1, 1, 1) })
          .call(resolve)
          .start()
      ),
      new Promise(resolve =>
        cc
          .tween(candy2.ins)
          .to(0.1, { position: candy1.ins.position, scale: new cc.Vec3(1, 1, 1) })
          .call(resolve)
          .start()
      ),
    ];
    await Promise.all(exchangePromises);
    return true;
  }

  private async _exchangeCandyByDirection(candyRC: cc.Vec2, direction: Types.Direction): Promise<cc.Vec2[]> {
    if (!candyRC) {
      return [];
    }
    let nextCandyRC = null;
    if (
      (direction === Types.Direction.UP && candyRC.x > 0) ||
      (direction === Types.Direction.DOWN && candyRC.x < Constants.BOARD_ROW - 1) ||
      (direction === Types.Direction.LEFT && candyRC.y > 0) ||
      (direction === Types.Direction.RIGHT && candyRC.y < Constants.BOARD_COL - 1)
    ) {
      nextCandyRC = new cc.Vec2();
      if (direction === Types.Direction.UP) {
        nextCandyRC.x = candyRC.x - 1;
        nextCandyRC.y = candyRC.y;
      }
      if (direction === Types.Direction.DOWN) {
        nextCandyRC.x = candyRC.x + 1;
        nextCandyRC.y = candyRC.y;
      }
      if (direction === Types.Direction.LEFT) {
        nextCandyRC.x = candyRC.x;
        nextCandyRC.y = candyRC.y - 1;
      }
      if (direction === Types.Direction.RIGHT) {
        nextCandyRC.x = candyRC.x;
        nextCandyRC.y = candyRC.y + 1;
      }
      await this._exchangeCandy(candyRC, nextCandyRC);
      return [candyRC, nextCandyRC];
    } else {
      return [];
    }
  }

  private async _checkMatch(candy1RC?: cc.Vec2, candy2RC?: cc.Vec2) {
    const needCancelCandy = new Set<string>();
    if (!candy1RC) {
      this._checkMatchHorizontal(-1).forEach(needCancelCandy.add, needCancelCandy);
      this._checkMatchVertical(-1).forEach(needCancelCandy.add, needCancelCandy);
    } else {
      if (candy1RC.x === candy2RC.x) {
        this._checkMatchHorizontal(candy1RC.x).forEach(needCancelCandy.add, needCancelCandy);
        this._checkMatchVertical(candy1RC.y).forEach(needCancelCandy.add, needCancelCandy);
        this._checkMatchVertical(candy2RC.y).forEach(needCancelCandy.add, needCancelCandy);
      } else {
        this._checkMatchVertical(candy1RC.y).forEach(needCancelCandy.add, needCancelCandy);
        this._checkMatchHorizontal(candy1RC.x).forEach(needCancelCandy.add, needCancelCandy);
        this._checkMatchHorizontal(candy2RC.x).forEach(needCancelCandy.add, needCancelCandy);
      }
    }
    return [...needCancelCandy].map(pair => new cc.Vec2(...pair.split(',').map(v => parseInt(v))));
  }

  /**
   * Find the candy that could be cancel on the special row.
   * If row === -1, mean should find all of the row.
   *
   * @param specialRow need to be checked row, can be -1.
   * @returns matched(mean need cancel) candy positions, ['r,c','r,c', ...etc]
   */
  private _checkMatchHorizontal(specialRow: number): string[] {
    const result = [];
    let matchCount = 1;
    let currentCandyType = '';
    const processMatch = (row: number, col: number) => {
      if (matchCount >= 3) {
        while (matchCount > 0) {
          result.push(`${row},${col - matchCount}`);
          matchCount--;
        }
      }
    };
    for (let row = specialRow === -1 ? 0 : specialRow; row < (specialRow === -1 ? Constants.BOARD_ROW : specialRow + 1); row++) {
      for (let col = 0; col < Constants.BOARD_COL; col++) {
        if (col === 0) {
          matchCount = 1;
          currentCandyType = this._getCandy(row, col).type;
        } else {
          const candy = this._getCandy(row, col);
          if (candy.type === currentCandyType) {
            // find match, count it
            matchCount++;
          } else {
            // not match, check prev match info
            processMatch(row, col);
            matchCount = 1;
            currentCandyType = candy.type;
            // If the penultimate candy doesn't match,
            // then none of the ones following it could possibly match.
            if (col === Constants.BOARD_COL - 2) {
              break;
            }
          }
        }
      }
      processMatch(row, Constants.BOARD_COL);
    }
    return result;
  }

  /**
   * Find the candy that could be cancel on the special col.
   * If col === -1, mean should find all of the rol.
   *
   * @param col need to be checked col, can be -1.
   * @returns matched(mean need cancel) candy positions, ['r,c','r,c', ...etc]
   */
  private _checkMatchVertical(specialCol: number): string[] {
    const result = [];
    let matchCount = 1;
    let currentCandyType = '';
    const processMatch = (row: number, col: number) => {
      if (matchCount >= 3) {
        while (matchCount > 0) {
          result.push(`${row - matchCount},${col}`);
          matchCount--;
        }
      }
    };
    for (let col = specialCol === -1 ? 0 : specialCol; col < (specialCol === -1 ? Constants.BOARD_COL : specialCol + 1); col++) {
      for (let row = 0; row < Constants.BOARD_ROW; row++) {
        if (row === 0) {
          matchCount = 1;
          currentCandyType = this._getCandy(row, col).type;
        } else {
          const candy = this._getCandy(row, col);
          if (candy.type === currentCandyType) {
            // find match, count it
            matchCount++;
          } else {
            // not match, check prev match info
            processMatch(row, col);
            matchCount = 1;
            currentCandyType = candy.type;
            // If the penultimate candy doesn't match,
            // then none of the ones following it could possibly match.
            if (row === Constants.BOARD_ROW - 2) {
              break;
            }
          }
        }
      }
      processMatch(Constants.BOARD_ROW, col);
    }
    return result;
  }

  private async _cancelCandy(needCancelCandyRCs: cc.Vec2[]) {
    const cancelAnimationPromises = [];
    this._updateScore(needCancelCandyRCs.length * Constants.CANDY_SCORE);
    needCancelCandyRCs.forEach(candyRC => {
      const p = new Promise(resolve => {
        const candy = this._getCandy(candyRC.x, candyRC.y);
        const animation = candy.ins.getComponent(cc.Animation);
        animation.once(
          cc.Animation.EventType.FINISHED,
          () => {
            candy.ins.active = false;
            resolve(true);
          },
          this
        );
        candy.state = CandyState.CANCELED;
        animation.play(`${Constants.EXPLOSION_ANIMATION_NAME_PREFIX}${candy.type}`);
      });
      cancelAnimationPromises.push(p);
    });
    await Promise.all(cancelAnimationPromises);
  }

  /**
   * Move the colum candy
   *
   * @param specialCol need to move col, can be -1.
   */
  private async _moveCandy(specialCol: number): Promise<cc.Vec2[]> {
    const needMoveCandy: { candy: CandyData; newPosition: cc.Vec3 }[] = [];
    const needGenerateCandy: cc.Vec2[] = [];
    const temp: CandyData[] = [];
    for (let col = specialCol === -1 ? 0 : specialCol; col < (specialCol === -1 ? Constants.BOARD_COL : specialCol + 1); col++) {
      let i = 0,
        j = Constants.BOARD_ROW - 1;
      for (let row = Constants.BOARD_ROW - 1; row >= 0; row--) {
        const candy = this._getCandy(row, col);
        if (candy.state === CandyState.CANCELED) {
          temp[i] = candy;
          needGenerateCandy.push(new cc.Vec2(i, col));
          i++;
        } else {
          temp[j] = candy;
          if (j !== row) {
            needMoveCandy.push({ candy, newPosition: this._getCandy(j, col).ins.position });
          }
          j--;
        }
      }
      temp.forEach((data, index) => (this._candyData[index][col] = data));
    }
    await Promise.all(
      needMoveCandy.map(v => {
        return new Promise(r => {
          cc.tween(v.candy.ins).to(0.1, { position: v.newPosition }).call(r).start();
        });
      })
    );
    return needGenerateCandy;
  }

  private async _generateCandy(needGenerateCandyRCs: cc.Vec2[]) {
    const tweenAnimations = [];
    needGenerateCandyRCs.forEach(rc => {
      const candy = this._getCandy(rc.x, rc.y);
      candy.ins.destroy();
      candy.type = this._randomGenerateCandyType(rc.x, rc.y, true);
      candy.ins = this._instantiateCandy(candy.type);
      this._placeCandy(rc.x, rc.y, candy.ins);
      candy.ins.setScale(0, 0);
      this.board.addChild(candy.ins);
      tweenAnimations.push(
        new Promise(r => {
          cc.tween(candy.ins)
            .to(0.3, { scale: new cc.Vec3(1, 1, 1) }, { easing: cc.easing.backInOut })
            .call(() => {
              candy.state = CandyState.NORMAL;
              r(true);
            })
            .start();
        })
      );
    });
    await Promise.all(tweenAnimations);
  }

  private _randomGenerateCandyType(row: number, col: number, canRepeat = false): string {
    const canUseTypes = this._candyTypes.filter(type => {
      if (canRepeat) return true;
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

  private _instantiateCandy(type: string): cc.Node {
    const prefab = this._candyNameToPrefabMap[type];
    if (!prefab) return null;
    const ins = cc.instantiate(prefab);
    const ui = ins.getComponent(cc.UITransform);
    ui.contentSize = new cc.Size(this._candySize, this._candySize);
    return ins;
  }

  private _placeCandy(row: number, col: number, candyNode: cc.Node) {
    candyNode.position = new cc.Vec3(
      -this._boardWidth / 2 + this._candySize / 2 + col * this._candySize,
      this._boardHeight / 2 - this._candySize / 2 - row * this._candySize,
      0
    );
  }

  private _getCandy(row: number, col: number): CandyData {
    return this._candyData[row][col];
  }

  private _getCandyIndexByNode(node: cc.Node): [number, number] {
    for (let row = 0; row < Constants.BOARD_ROW; ++row) {
      for (let col = 0; col < Constants.BOARD_COL; ++col) {
        const candy = this._candyData[row][col];
        if (candy.ins === node) {
          return [row, col];
        }
      }
    }
  }

  private _updateScore(score: number) {
    this._score.value += score;
    cc.tween(this._score).to(0.3, { animating: this._score.value }, {
      onUpdate:(target: any, ratio) => {
        this.scoreText.getComponent(cc.Label).string = `${Math.floor(target.animating)}`
      },
    }).start();
  }
}
