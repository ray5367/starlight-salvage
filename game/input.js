// Keyboard and mouse input, translated into the game's 1280x720 space.
// Keys are tracked by event.code; presses are edge-triggered and cleared once
// per frame; mouse clicks are queued and consumed once, so a click that starts
// the game never also fires the tether.

export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

const SCROLL_KEYS = ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();
    this.mouse = { x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2, down: false, pressed: false };
    this.clicks = [];
    this.anyGesture = false;
    // Screenshot staging only: ?shot=play holds the tether so the staged
    // mid-drag state renders as the player sees it. Never set during play.
    this.overrideHeld = false;
  }

  attach() {
    const toGame = (event) => {
      const rect = this.canvas.getBoundingClientRect();
      return {
        x: ((event.clientX - rect.left) / rect.width) * GAME_WIDTH,
        y: ((event.clientY - rect.top) / rect.height) * GAME_HEIGHT,
      };
    };

    window.addEventListener('keydown', (event) => {
      if (SCROLL_KEYS.includes(event.code)) event.preventDefault();
      if (!event.repeat) this.pressed.add(event.code);
      this.keys.add(event.code);
      this.anyGesture = true;
    });
    window.addEventListener('keyup', (event) => {
      this.keys.delete(event.code);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouse.down = false;
    });
    this.canvas.addEventListener('mousemove', (event) => {
      const point = toGame(event);
      this.mouse.x = point.x;
      this.mouse.y = point.y;
    });
    this.canvas.addEventListener('mousedown', (event) => {
      const point = toGame(event);
      this.mouse.x = point.x;
      this.mouse.y = point.y;
      if (event.button === 0) {
        this.mouse.down = true;
        this.mouse.pressed = true;
        this.clicks.push({ x: point.x, y: point.y });
      }
      this.anyGesture = true;
    });
    window.addEventListener('mouseup', (event) => {
      if (event.button === 0) this.mouse.down = false;
    });
    this.canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  isDown(code) {
    return this.keys.has(code);
  }

  wasPressed(code) {
    return this.pressed.has(code);
  }

  tetherHeld() {
    return this.overrideHeld || this.isDown('Space') || this.mouse.down;
  }

  consumeClick() {
    return this.clicks.shift() ?? null;
  }

  clearMomentary() {
    this.keys.clear();
    this.pressed.clear();
    this.clicks.length = 0;
    this.mouse.down = false;
    this.mouse.pressed = false;
  }

  endFrame() {
    this.pressed.clear();
    this.clicks.length = 0;
    this.mouse.pressed = false;
    this.anyGesture = false;
  }
}
