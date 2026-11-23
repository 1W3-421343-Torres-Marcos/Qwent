import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { AbilityType, RowType } from '../../../core';

@Component({
  selector: 'app-row-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (row()) {
      @case ('CLOSE_COMBAT') {
        <svg viewBox="0 0 24 24" class="h-full w-full fill-current" aria-hidden="true">
          <path d="M19.5 3.5L13 10l-1.5-1.5-1.4 1.4L11.6 11.4 5 18l-1.5 2.5L6 19l6.6-6.6 1.5 1.5 1.4-1.4L14 11l6.5-6.5V3.5h-1z" />
        </svg>
      }
      @case ('RANGED') {
        <svg viewBox="0 0 24 24" class="h-full w-full fill-current" aria-hidden="true">
          <path d="M5 19c4.5-1 8.5-5 9.5-9.5L17 7l1.5 1.5L21 3l-5.5 2.5L17 7l-2.5 2.5C11 8.5 7 4.5 5 3v2c1.8 1.5 5 4.7 6.2 7.8C8.1 14 5.5 16.5 4 18l1 1z" />
        </svg>
      }
      @case ('SIEGE') {
        <svg viewBox="0 0 24 24" class="h-full w-full fill-current" aria-hidden="true">
          <path d="M4 17h16v2H4v-2zm3-2a2 2 0 100 4 2 2 0 000-4zm10 0a2 2 0 100 4 2 2 0 000-4zm-9-2l6-7 2 1.5-4.5 5.5H17v2H8v-2zm8-8a2 2 0 110 4 2 2 0 010-4z" />
        </svg>
      }
      @case ('AGILE') {
        <svg viewBox="0 0 24 24" class="h-full w-full fill-current" aria-hidden="true">
          <path d="M7 7l-4 5 4 5v-3h10v3l4-5-4-5v3H7V7z" />
        </svg>
      }
    }
  `,
})
export class RowIconComponent {
  readonly row = input.required<RowType | 'AGILE'>();
}

@Component({
  selector: 'app-ability-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (ability()) {
      @case ('TIGHT_BOND') {
        <svg viewBox="0 0 24 24" class="h-full w-full fill-current" aria-hidden="true">
          <path d="M8.5 12.5a3.5 3.5 0 010-5l2-2a3.5 3.5 0 015 5l-.8.8-1.4-1.4.8-.8a1.5 1.5 0 10-2.1-2.1l-2 2a1.5 1.5 0 002.1 2.1l.4-.4 1.4 1.4-.4.4a3.5 3.5 0 01-5 0zm7-1a3.5 3.5 0 010 5l-2 2a3.5 3.5 0 01-5-5l.8-.8 1.4 1.4-.8.8a1.5 1.5 0 002.1 2.1l2-2a1.5 1.5 0 00-2.1-2.1l-.4.4-1.4-1.4.4-.4a3.5 3.5 0 015 0z" />
        </svg>
      }
      @case ('MORALE_BOOST') {
        <svg viewBox="0 0 24 24" class="h-full w-full fill-current" aria-hidden="true">
          <path d="M11 4h2v7h7v2h-7v7h-2v-7H4v-2h7V4z" />
        </svg>
      }
      @case ('SPY') {
        <svg viewBox="0 0 24 24" class="h-full w-full fill-current" aria-hidden="true">
          <path d="M12 5C6.5 5 2 9.5 1 12c1 2.5 5.5 7 11 7s10-4.5 11-7c-1-2.5-5.5-7-11-7zm0 11a4 4 0 110-8 4 4 0 010 8zm0-6a2 2 0 100 4 2 2 0 000-4z" />
        </svg>
      }
      @case ('MEDIC') {
        <svg viewBox="0 0 24 24" class="h-full w-full fill-current" aria-hidden="true">
          <path d="M12 21s-7-4.5-9-9a5.2 5.2 0 019-4.5A5.2 5.2 0 0121 12c-2 4.5-9 9-9 9zm-1-11H9v2h2v2h2v-2h2v-2h-2V8h-2v2z" />
        </svg>
      }
      @case ('MUSTER') {
        <svg viewBox="0 0 24 24" class="h-full w-full fill-current" aria-hidden="true">
          <path d="M12 4a2.5 2.5 0 110 5 2.5 2.5 0 010-5zm-6 3a2 2 0 110 4 2 2 0 010-4zm12 0a2 2 0 110 4 2 2 0 010-4zM8 14c0-2.2 1.8-3.5 4-3.5s4 1.3 4 3.5v4H8v-4zm-6 1c0-1.7 1.3-2.8 3-2.8h1.5c-.3.6-.5 1.3-.5 2.1V18H2v-3zm16-2.8H19c1.7 0 3 1.1 3 2.8v3h-4v-3.7c0-.8-.2-1.5-.5-2.1z" />
        </svg>
      }
      @case ('DECOY') {
        <svg viewBox="0 0 24 24" class="h-full w-full fill-current" aria-hidden="true">
          <path d="M12 3L4 7v5c0 4.5 3.4 8.4 8 9.5 4.6-1.1 8-5 8-9.5V7l-8-4zm-3 8a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm6 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm-6 4c1 1.3 2.2 2 3 2s2-.7 3-2H9z" />
        </svg>
      }
      @case ('COMMANDERS_HORN') {
        <svg viewBox="0 0 24 24" class="h-full w-full fill-current" aria-hidden="true">
          <path d="M3 10v4h4l9 5V5L7 10H3zm15.5 2c0-1.8-1-3.3-2.5-4v8c1.5-.7 2.5-2.2 2.5-4z" />
        </svg>
      }
      @case ('WEATHER_FROST') {
        <svg viewBox="0 0 24 24" class="h-full w-full fill-current" aria-hidden="true">
          <path d="M11 2h2v4.2l2.6-1.5 1 1.7-3.6 2.1v2.5l2.2 1.3 3.6-2.1 1 1.7-2.6 1.5 2.6 1.5-1 1.7-3.6-2.1-2.2 1.3v2.5l3.6 2.1-1 1.7L13 17.8V22h-2v-4.2l-2.6 1.5-1-1.7 3.6-2.1V13l-2.2-1.3-3.6 2.1-1-1.7 2.6-1.5-2.6-1.5 1-1.7 3.6 2.1 2.2-1.3V8.5L7.4 6.4l1-1.7L11 6.2V2z" />
        </svg>
      }
      @case ('WEATHER_FOG') {
        <svg viewBox="0 0 24 24" class="h-full w-full fill-current" aria-hidden="true">
          <path d="M6 15h12a4 4 0 00.8-7.9A5.5 5.5 0 008.2 6.5 4.5 4.5 0 006 15zm-2 2h16v2H4v-2zm2 3h12v2H6v-2z" />
        </svg>
      }
      @case ('WEATHER_RAIN') {
        <svg viewBox="0 0 24 24" class="h-full w-full fill-current" aria-hidden="true">
          <path d="M12 2.5C12 2.5 6 9.8 6 14.2A6 6 0 0018 14.2C18 9.8 12 2.5 12 2.5zm0 15.5a3 3 0 01-3-3c0-.9.5-2.1 1.3-3.4.3 2 1.1 3.3 2.7 4-.3.8-.6 2.4-1 2.4z" />
        </svg>
      }
      @case ('WEATHER_CLEAR') {
        <svg viewBox="0 0 24 24" class="h-full w-full fill-current" aria-hidden="true">
          <path d="M12 7a5 5 0 100 10 5 5 0 000-10zm-1-5h2v3h-2V2zm0 17h2v3h-2v-3zM2 11h3v2H2v-2zm17 0h3v2h-3v-2zM4.9 6.3l1.4-1.4 2.1 2.1-1.4 1.4-2.1-2.1zm10.7 10.7l1.4-1.4 2.1 2.1-1.4 1.4-2.1-2.1zM17 7l2.1-2.1 1.4 1.4L18.4 8.4 17 7zM4.9 17.7L7 15.6l1.4 1.4-2.1 2.1-1.4-1.4z" />
        </svg>
      }
      @case ('SCORCH') {
        <svg viewBox="0 0 24 24" class="h-full w-full fill-current" aria-hidden="true">
          <path d="M13.5 2s.5 3.5-2 6c-1.8 1.8-3 4-3 6.2a5.5 5.5 0 0011 0c0-3.2-2.2-6-6-12.2z" />
        </svg>
      }
      @case ('SCORCH_ROW') {
        <svg viewBox="0 0 24 24" class="h-full w-full fill-current" aria-hidden="true">
          <path d="M13.5 2s.5 3.5-2 6c-1.8 1.8-3 4-3 6.2a5.5 5.5 0 0011 0c0-3.2-2.2-6-6-12.2z" />
        </svg>
      }
    }
  `,
})
export class AbilityIconComponent {
  readonly ability = input.required<AbilityType>();
}
