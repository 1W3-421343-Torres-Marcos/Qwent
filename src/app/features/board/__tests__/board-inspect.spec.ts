import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relative: string): string =>
  readFileSync(resolve(process.cwd(), 'src/app', relative), 'utf8');

/**
 * Regresión U9.1: el toque en una carta del tablero no debe burbujear hasta
 * `onBackdropClick()` (clearSelection), o la tarjeta de inspección se cierra al instante.
 */
describe('Inspección de cartas del tablero (U9)', () => {
  const row = read('features/board/components/board-row.component.ts');
  const page = read('features/board/board-page.component.ts');
  const overlays = read('features/board/components/board-overlays.component.ts');

  it('los tokens de fila detienen la propagación del clic hacia el fondo', () => {
    const token = row.match(/<app-card-token[\s\S]*?\/>/);
    expect(token).not.toBeNull();
    expect(token?.[0]).toContain('$event.stopPropagation()');
  });

  it('la ranura de Cuerno con carta es inspeccionable aunque la fila no sea seleccionable', () => {
    expect(row).toContain('!isSelectable() && !row().hornCard');
    expect(row).toContain('this.cardInspected.emit(horn)');
  });

  it('las cartas de clima activas abren el inspector', () => {
    expect(page).toContain('onWeatherSlotClick($event, weatherEntry?.card ?? null)');
  });

  it('las cartas del descarte emiten inspección y el tablero la conecta', () => {
    expect(overlays).toContain('cardInspected.emit(card)');
    expect(page).toMatch(/\(discardClosed\)="facade\.closeDiscardModal\(\)"\s+\(cardInspected\)="onInspectFromBoard\(\$event\)"/);
  });
});
