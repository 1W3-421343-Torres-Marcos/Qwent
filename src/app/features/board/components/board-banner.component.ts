import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { BannerIcon, BannerTone, BoardBannerData } from '../../../services/board-events.utils';

const TONE_CLASSES: Readonly<Record<BannerTone, string>> = {
  GOLD: 'border-gold-bright/90 bg-tavern-dark/95 text-gold-bright shadow-[0_0_24px_rgba(217,119,6,0.45)]',
  CRIMSON: 'border-strength-nerf/90 bg-tavern-dark/95 text-strength-nerf shadow-[0_0_24px_rgba(220,38,38,0.4)]',
  EMERALD: 'border-strength-buff/90 bg-tavern-dark/95 text-strength-buff shadow-[0_0_24px_rgba(34,197,94,0.35)]',
  NEUTRAL: 'border-bronze bg-tavern-dark/95 text-parchment shadow-2xl',
};

const ICON_SYMBOL: Readonly<Record<BannerIcon, string>> = {
  COIN: '🪙',
  TURN: '⚔',
  PASS: '✋',
  ROUND: '⚜',
  FACTION: '★',
};

@Component({
  selector: 'app-board-banner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (banner(); as b) {
      <div class="pointer-events-none fixed inset-x-0 top-1/2 z-30 flex -translate-y-1/2 justify-center px-4">
        @for (item of [b]; track item.id) {
          <div
            class="qwent-banner-enter flex max-w-md items-center gap-3 rounded-xl border-2 px-5 py-2.5 backdrop-blur-sm"
            [class]="toneClass(item.tone)"
          >
            <span
              class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-current/40 bg-black/40 text-base leading-none"
            >
              {{ iconSymbol(item.icon) }}
            </span>
            <div class="min-w-0 text-left">
              <p class="font-serif text-sm sm:text-base font-extrabold uppercase tracking-wider leading-tight">
                {{ item.title }}
              </p>
              @if (item.subtitle) {
                <p class="mt-0.5 truncate text-[11px] font-medium text-parchment/85">
                  {{ item.subtitle }}
                </p>
              }
            </div>
          </div>
        }
      </div>
    }
  `,
})
export class BoardBannerComponent {
  readonly banner = input<BoardBannerData | null>(null);

  toneClass(tone: BannerTone): string {
    return TONE_CLASSES[tone];
  }

  iconSymbol(icon: BannerIcon): string {
    return ICON_SYMBOL[icon];
  }
}
