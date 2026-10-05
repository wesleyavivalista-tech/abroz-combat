import { Button, type InputSample } from "../types.js";
export function direction(mask: number, facing: number): number {
  const horizontal =
    (mask & Button.Right ? 1 : 0) - (mask & Button.Left ? 1 : 0);
  const vertical = (mask & Button.Up ? 1 : 0) - (mask & Button.Down ? 1 : 0);
  return 5 + horizontal * facing + vertical * 3;
}
export function record(
  buffer: InputSample[],
  frame: number,
  mask: number,
  previous: number,
  facing: number,
): void {
  buffer.push({
    frame,
    mask,
    pressed: mask & ~previous,
    direction: direction(mask, facing),
  });
  if (buffer.length > 40) buffer.shift();
}
export function motion(
  buffer: InputSample[],
  notation: string,
  window = 22,
): boolean {
  if (!buffer.length) return false;
  const end = buffer[buffer.length - 1].frame;
  let target = notation.length - 1;
  for (let i = buffer.length - 1; i >= 0; i--) {
    const sample = buffer[i];
    if (end - sample.frame > window) break;
    if (sample.direction === Number(notation[target])) {
      target--;
      if (target < 0) return true;
    }
  }
  return false;
}
export function doubleTap(buffer: InputSample[], dir: number): boolean {
  const recent = buffer.slice(-13);
  if (
    recent.length < 3 ||
    recent[recent.length - 1].direction !== dir ||
    recent[recent.length - 2].direction === dir
  )
    return false;
  return recent
    .slice(0, -2)
    .some((s, i, a) => s.direction === dir && a[i + 1]?.direction !== dir);
}
export function bufferedButton(
  buffer: InputSample[],
  frame: number,
  button: number,
): boolean {
  return buffer.some((s) => frame - s.frame <= 5 && !!(s.pressed & button));
}
export function consumeButtons(buffer: InputSample[]): void {
  for (const sample of buffer) sample.pressed = 0;
}

/** Physical left/right taps stay consistent when the first tap turns the fighter. */
export function doubleTapHorizontal(buffer:InputSample[],button:Button.Left|Button.Right):boolean{
 const recent=buffer.slice(-13),axis=Button.Left|Button.Right;
 const held=(sample:InputSample)=> (sample.mask&axis)===button;
 if(recent.length<3||!held(recent[recent.length-1])||held(recent[recent.length-2]))return false;
 return recent.slice(0,-2).some((sample,i)=>held(sample)&&!held(recent[i+1]));
}

/** Require two distinct Down presses, allowing horizontal steering between taps. */
export function doubleTapDown(buffer:InputSample[]):boolean{
 const recent=buffer.slice(-13);
 const held=(sample:InputSample)=>!!(sample.mask&Button.Down)&&!(sample.mask&Button.Up);
 if(recent.length<3||!held(recent[recent.length-1])||held(recent[recent.length-2]))return false;
 return recent.slice(0,-2).some((sample,i)=>held(sample)&&!held(recent[i+1]));
}
