import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { QWENT_PHASE } from '../core';
import { BoardPageComponent } from './features/board/board-page.component';
import { GameFacadeService } from './services/game-facade.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [BoardPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (inMatch()) {
      <app-board-page />
    } @else {
      <main
        class="flex h-dvh w-screen items-center justify-center bg-tavern-dark text-parchment p-[env(safe-area-inset-top)_env(safe-area-inset-right)_env(safe-area-inset-bottom)_env(safe-area-inset-left)]"
      >
        <section
          class="mx-4 flex w-full max-w-xl flex-col items-center gap-4 rounded-xl border-2 border-bronze bg-board-wood px-8 py-6 text-center shadow-2xl"
        >
          <div class="flex flex-wrap items-center justify-center gap-2">
            <span
              class="rounded border border-gold/60 bg-row-leather px-3 py-1 text-xs font-bold uppercase tracking-widest text-gold"
            >
              Fase {{ phase }} — Habilidades TW3
            </span>
            <span
              class="rounded border border-bronze bg-tavern-dark/80 px-3 py-1 text-xs font-medium text-parchment/80"
            >
              100% Offline • TW3 Clásico
            </span>
          </div>

          <header>
            <h1 class="font-serif text-4xl font-extrabold tracking-[0.2em] text-gold-bright drop-shadow">
              QWENT
            </h1>
            <p class="mt-1 text-sm text-parchment/85">
              Reinos del Norte vs. Imperio Nilfgaardiano (2 Jugadores Local)
            </p>
          </header>

          <button
            type="button"
            (click)="startLocalMatch()"
            class="mt-2 min-h-[48px] w-full max-w-xs rounded-lg border-2 border-gold-bright bg-gold/25 px-6 py-3 text-sm font-bold uppercase tracking-wider text-gold-bright shadow-lg transition active:scale-95"
          >
            Jugar Partida Local
          </button>
        </section>
      </main>
    }
  `,
})
export class AppComponent {
  private readonly facade = inject(GameFacadeService);
  readonly phase = QWENT_PHASE;
  readonly inMatch = signal(false);

  startLocalMatch(): void {
    this.facade.startNewMatch();
    this.inMatch.set(true);
  }
}
