type Rectangle = { left: number; top: number; right: number; bottom: number; width: number };
type Viewport = { left: number; top: number; width: number; height: number };

/** Fixed-position coordinates, including mobile visual viewport/keyboard insets. */
export function driverDropdownPosition(anchor: Rectangle, viewport: Viewport, compact: boolean) {
  const margin = 8, gap = 4, preferredHeight = 288;
  const width = Math.min(Math.max(anchor.width, compact ? 0 : 288), Math.max(0, viewport.width - margin * 2));
  const left = Math.max(viewport.left + margin, Math.min(anchor.left, viewport.left + viewport.width - margin - width));
  const below = Math.max(0, viewport.top + viewport.height - margin - anchor.bottom - gap);
  const above = Math.max(0, anchor.top - viewport.top - margin - gap);
  const upwards = below < 160 && above > below;
  const maxHeight = Math.min(preferredHeight, upwards ? above : below);
  return { left, top: upwards ? anchor.top - gap : anchor.bottom + gap, width, maxHeight, upwards };
}
