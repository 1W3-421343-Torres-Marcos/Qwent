import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { FactionId } from '../../../core';

@Component({
  selector: 'app-faction-emblem',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (faction()) {
      @case ('NORTHERN_REALMS') {
        <svg viewBox="0 0 24 24" class="h-full w-full" fill="currentColor" aria-hidden="true">
          <path d="M12 2c-1.8 2.4-2.5 4.9-1.5 7.2-1.8-1.4-4-1.8-6-1 1.4 1.6 1.8 3.6 1.1 5.6H4v2.2h6.8V21h2.4v-5H20v-2.2h-1.6c-.7-2-.3-4 1.1-5.6-2-.8-4.2-.4-6 1 1-2.3.3-4.8-1.5-7.2Z" />
        </svg>
      }
      @case ('NILFGAARD') {
        <svg viewBox="0 0 24 24" class="h-full w-full" fill="currentColor" aria-hidden="true">
          <path d="M12 1.5 13.7 6l4.4-2.4-1.5 4.7 4.9.5-4.1 2.7 3.7 3.2-4.8-.1.9 4.9-4.1-2.8L12 22.5l-1.1-5.8-4.1 2.8.9-4.9-4.8.1 3.7-3.2L2.5 8.8l4.9-.5L5.9 3.6 10.3 6 12 1.5Zm0 6.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" />
        </svg>
      }
      @case ('MONSTERS') {
        <svg viewBox="0 0 24 24" class="h-full w-full" fill="currentColor" aria-hidden="true">
          <path d="M5 3c2 3.5 2.3 8 .5 13.5L3.5 21c2.8-2.3 4.6-6.2 4.9-11.5L9.5 4.8 5 3Zm6.5-1c1.8 4.4 1.9 9.5-.1 16L10 22c3-2.9 4.8-7.6 5-14L15.8 3 11.5 2Zm6.5 2c1.4 3.6 1.4 7.8-.2 13.2L16.5 21c2.4-2.3 4-6.3 4.2-11.8L21 5l-3-1Z" />
        </svg>
      }
      @case ('SCOIATAEL') {
        <svg viewBox="0 0 24 24" class="h-full w-full" fill="currentColor" aria-hidden="true">
          <path d="M19.5 3.5c-5.2.3-9.8 2.8-12.7 7.1-1.3 2-2 4.3-2.3 6.9l-2 2 1.4 1.4 2.1-2.1c2.6-.3 4.9-1 6.9-2.3 4.3-2.9 6.8-7.5 6.6-13Zm-4.2 4.2-6.8 6.8c-.7-2 .3-4.6 2.5-6 1.4-.9 2.9-1.1 4.3-.8Z" />
        </svg>
      }
      @default {
        <svg viewBox="0 0 24 24" class="h-full w-full" fill="currentColor" aria-hidden="true">
          <path d="M12 2 14.8 8.6 22 9.3l-5.4 4.7 1.7 7-6.3-3.8L5.7 21l1.7-7L2 9.3l7.2-.7L12 2Z" />
        </svg>
      }
    }
  `,
})
export class FactionEmblemComponent {
  readonly faction = input.required<FactionId>();
}
