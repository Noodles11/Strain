import type { IconId } from '../core/cards';

/** Small effect icons for card faces, 16×16, drawn in the text colour. */
const PATHS: Record<IconId, string> = {
  // a blade, point up-right
  dmg: '<path d="M13.5 1.5 L15 3 L6 12 L4 10 Z"/><path d="M2.5 10.5 L6 14 L4.8 15.2 L1 11.5 Z"/><path d="M1.5 13.5 L3 15" stroke="currentColor" stroke-width="1.6"/>',
  // three heads
  all: '<circle cx="3" cy="9" r="2.2"/><circle cx="8" cy="6" r="2.4"/><circle cx="13" cy="9" r="2.2"/><path d="M1 14 Q3 11 5 14 M5.5 14 Q8 10 10.5 14 M11 14 Q13 11 15 14" stroke="currentColor" stroke-width="1.4" fill="none"/>',
  // hex plate
  plate: '<path d="M8 1 L14.5 4.5 L14.5 11.5 L8 15 L1.5 11.5 L1.5 4.5 Z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 4.5 L11.5 6.3 L11.5 9.7 L8 11.5 L4.5 9.7 L4.5 6.3 Z"/>',
  heal: '<path d="M6 1.5 H10 V6 H14.5 V10 H10 V14.5 H6 V10 H1.5 V6 H6 Z"/>',
  // two cards fanned
  draw: '<rect x="1.5" y="3" width="8" height="11" rx="1" fill="none" stroke="currentColor" stroke-width="1.6" transform="rotate(-10 5.5 8.5)"/><rect x="6.5" y="2" width="8" height="11" rx="1"/>',
  energy: '<path d="M8 1 L15 8 L8 15 L1 8 Z"/>',
  // a fist going down
  weak: '<path d="M8 1.5 V11" stroke="currentColor" stroke-width="2.2"/><path d="M3 8.5 L8 14.5 L13 8.5 Z"/>',
  // cracked target
  expose: '<circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="8" cy="8" r="2"/><path d="M8 0.5 V4 M8 12 V15.5 M0.5 8 H4 M12 8 H15.5" stroke="currentColor" stroke-width="1.6"/>',
  // a hook
  tag: '<path d="M10 1.5 V9 A4 4 0 1 1 2 9 V7.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M0.5 8.5 L2 5.5 L3.5 8.5 Z"/>',
  // cross in a ring
  triage: '<circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M7 4 H9 V7 H12 V9 H9 V12 H7 V9 H4 V7 H7 Z"/>',
  // double chevron up
  empower: '<path d="M2 9 L8 3 L14 9" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M2 14 L8 8 L14 14" fill="none" stroke="currentColor" stroke-width="2.2"/>',
  // two fangs
  drain: '<path d="M1.5 3 H14.5" stroke="currentColor" stroke-width="2"/><path d="M3 3 L5.5 13 L8 3 Z M8 3 L10.5 13 L13 3 Z"/>',
  // a twist of helix
  surge: '<path d="M4 1 Q12 5 4 8 Q-4 11 4 15 M12 1 Q4 5 12 8 Q20 11 12 15" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  // broken hex
  shatter: '<path d="M8 1 L14.5 4.5 L14.5 11.5 L8 15 L1.5 11.5 L1.5 4.5 Z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 2 L6.5 7 L9.5 9 L7.5 14.5" fill="none" stroke="currentColor" stroke-width="1.6"/>',
  // a drop
  bio: '<path d="M8 1 Q14 8 14 10.5 A6 6 0 0 1 2 10.5 Q2 8 8 1 Z"/>',
  key: '<circle cx="4.5" cy="8" r="3.2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M7.5 8 H15 M12 8 V11.5 M14.5 8 V10.5" stroke="currentColor" stroke-width="2"/>',
  // a flame
  cut: '<path d="M8 1 Q12 6 11.5 9.5 A3.5 4.5 0 0 1 4.5 9.5 Q4.5 7 6.5 5 Q7 7.5 8.5 8 Q9.5 5 8 1 Z"/><path d="M2 15 H14" stroke="currentColor" stroke-width="1.6"/>',
  scan: '<path d="M2 12 A8 8 0 0 1 14 12" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M4.5 12 A5 5 0 0 1 11.5 12" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="8" cy="12" r="1.8"/>',
  flare: '<circle cx="8" cy="8" r="3.2"/><path d="M8 0.5 V3 M8 13 V15.5 M0.5 8 H3 M13 8 H15.5 M2.7 2.7 L4.4 4.4 M11.6 11.6 L13.3 13.3 M2.7 13.3 L4.4 11.6 M11.6 4.4 L13.3 2.7" stroke="currentColor" stroke-width="1.5"/>',
  notes: '<path d="M11.5 1.5 L14.5 4.5 L6 13 L2.5 13.5 L3 10 Z"/><path d="M1.5 15.2 H14.5" stroke="currentColor" stroke-width="1.2"/>',
  seal: '<path d="M8 1 L14.5 4.5 L14.5 11.5 L8 15 L1.5 11.5 L1.5 4.5 Z"/><path d="M5 8 L7.2 10.2 L11 5.8" fill="none" stroke="#1d1f23" stroke-width="1.8"/>',
  pry: '<path d="M2.5 14 L11 5.5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M11 5.5 Q13.5 2.5 15 4.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
  beacon: '<path d="M8 15 V7" stroke="currentColor" stroke-width="2"/><circle cx="8" cy="4.5" r="3"/><path d="M3 2 Q1.5 4.5 3 7 M13 2 Q14.5 4.5 13 7" fill="none" stroke="currentColor" stroke-width="1.3"/>',
  // a half-shut eye
  stalk: '<path d="M1 8 Q8 2 15 8 Q8 12 1 8 Z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M1 8 Q8 4 15 8" /><circle cx="8" cy="8.2" r="1.8"/>',
};

export function icon(id: IconId): string {
  return `<i class="ic ic-${id}"><svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">${PATHS[id]}</svg></i>`;
}
