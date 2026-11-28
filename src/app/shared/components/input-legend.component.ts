import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { InputBridgeService } from '../../services/input-bridge.service';

@Component({
  selector: 'app-input-legend',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (inputBridge.inputMode() === 'controller') {
      <aside
        aria-label="Controles de teclado y mando"
        class="pointer-events-none fixed bottom-1 left-1/2 z-[70] -translate-x-1/2 rounded border border-gold/60 bg-tavern-dark/95 px-2 py-1 text-center text-[9px] font-semibold text-parchment shadow-xl sm:text-[10px]"
      >
        Flechas: mover · A/Enter: confirmar · B/Esc: volver · X: Líder · Mantener Y: pasar · Start/M: menú
      </aside>
    }
  `,
})
export class InputLegendComponent {
  readonly inputBridge = inject(InputBridgeService);
}
