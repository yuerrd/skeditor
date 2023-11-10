import { Disposable } from '../base/disposable';
import { fromEvent } from 'rxjs';
import bowser from 'bowser';
import { Point } from '../base/point';
import { fromDragEvent } from '../util/drag';

export interface IZoomListener {
  /**
   * 缩放操作结束后，设置最终的 scale
   * @param scaleMultiply 缩放的倍数
   * @param center 缩放的中心点
   */
  onScale(scaleMultiply: number, center: Point);
  /**
   * 平移操作结束后，设置最终的 offset
   * @param delta 平移的偏移量
   */
  onOffset(delta: Point);
}
export class ZoomController extends Disposable {
  /**
   * 实际的响应zoom的区域，相对 el 的偏移。
   * 一般都设置为 正数，表示区域小于实际的 canvas
   */
  private offset = new Point();

  constructor(private el: HTMLCanvasElement, private service: IZoomListener) {
    super();

    this._disposables.push(fromEvent(this.el, 'wheel').subscribe(this.onWheel));

    this.bindDragEvents();

    if (bowser.safari) {
      this.bindGesture();
    }
  }

  private bindDragEvents() {
    let preDx = 0;
    let preDy = 0;

    this._disposables.push(
      fromDragEvent(this.el).subscribe((event) => {
        switch (event.type) {
          case 'dragStart':
            preDx = 0;
            preDy = 0;
            return;
          case 'dragging': {
            const { dx, dy } = event;
            const offset = new Point(preDx - dx, preDy - dy);
            this.service.onOffset(offset);
            preDx = dx;
            preDy = dy;
            return;
          }
          case 'dragEnd':
            // console.log('drag end');
            return;
        }
      })
    );
  }

  public setOffset(offset: Point) {
    this.offset = offset;
  }

  private onWheel = (_e: Event) => {
    const e = _e as WheelEvent;

    e.preventDefault();
    // 按下了 Ctrl 键（或者 Mac 中的 Command 键）
    if (e.ctrlKey || e.metaKey) {
      const scaleMultiply = (100 - 1.5 * this.getScaleDelta(e)) / 100;
      console.log('scaleMultiply', scaleMultiply);
      this.service.onScale(scaleMultiply, new Point(e.offsetX - this.offset.x, e.offsetY - this.offset.x));
    } else {
      this.service.onOffset(this.getOffsetDelta(e));
    }
  };

  private getScaleDelta(e: WheelEvent): number {
    if (e.deltaMode === 1) {
      return e.deltaY * 15;
    } else if (e.deltaY < 20 && e.deltaY > -20) {
      return e.deltaY;
    } else {
      return Math.max(Math.min(e.deltaY, 20), -20);
    }
  }

  private getOffsetDelta(e: WheelEvent): Point {
    if (bowser.windows && e.shiftKey) {
      return new Point(e.deltaY, 0);
    }
    return new Point(e.deltaX, e.deltaY);
  }

  /**
   * Safari pinch 事件
   * @see https://medium.com/@auchenberg/detecting-multi-touch-trackpad-gestures-in-javascript-a2505babb10e
   */
  private bindGesture() {
    const startPoint = new Point();
    let lastScale = 1;
    // 应该是 GestureEvent, 但 ts 中没有
    const onGesture = (e: any) => {
      e.preventDefault();
      if (e.type === 'gesturestart') {
        startPoint.x = e.layerX;
        startPoint.y = e.layerY;
        lastScale = 1;
      }
      if (e.type === 'gesturechange') {
        const gestureScale = (e as any).scale as number;
        const scaleMultiply = gestureScale / lastScale;
        lastScale = gestureScale;
        this.service.onScale(scaleMultiply, startPoint.minus(this.offset));
      }

      if (e.type === 'gestureend') {
        //
      }
    };
    this._disposables.push(fromEvent(this.el, 'gesturestart').subscribe(onGesture));
    this._disposables.push(fromEvent(this.el, 'gesturechange').subscribe(onGesture));
    this._disposables.push(fromEvent(this.el, 'gestureend').subscribe(onGesture));
  }
}
