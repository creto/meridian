export function nextIndex(current: number, length: number, delta: number): number {
  if (length <= 0) return 0;
  return (current + delta + length) % length;
}

export function trapTab(current: number, length: number, shift: boolean): number {
  return nextIndex(current, length, shift ? -1 : 1);
}

export function validationAnnouncement(errors: Array<{ label: string; message: string }>): string {
  if (!errors.length) return "No validation errors";
  const first = errors[0]!;
  return `${errors.length} ${errors.length === 1 ? "error" : "errors"}. ${first.label}: ${first.message}`;
}

function channel(hex: string, index: number): number {
  return Number.parseInt(hex.slice(index, index + 2), 16) / 255;
}

function luminance(hex: string): number {
  const clean = hex.replace("#", "");
  const expand = clean.length === 3 ? clean.split("").map((char) => char + char).join("") : clean;
  const parts = [0, 2, 4].map((index) => {
    const value = channel(expand, index);
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * parts[0]! + 0.7152 * parts[1]! + 0.0722 * parts[2]!;
}

export function contrastRatio(foreground: string, background: string): number {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

export function wcagAA(foreground: string, background: string, large = false): boolean {
  return contrastRatio(foreground, background) >= (large ? 3 : 4.5);
}

export const PDF_KEYS = {
  ArrowLeft: "nudge left",
  ArrowRight: "nudge right",
  ArrowUp: "nudge up",
  ArrowDown: "nudge down",
  Delete: "delete selection",
  "Ctrl+Z": "undo",
  "Ctrl+Shift+Z": "redo",
  "Ctrl+D": "duplicate",
} as const;
