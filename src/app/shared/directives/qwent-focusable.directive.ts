import {
  booleanAttribute,
  Directive,
  ElementRef,
  HostBinding,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  inject,
  type SimpleChanges,
} from '@angular/core';
import { SpatialFocusService } from '../../services/spatial-focus.service';
import { QwentFocusScopeDirective } from './qwent-focus-scope.directive';

@Directive({
  selector: 'button, select, input, textarea, [qwentFocusable]',
  standalone: true,
})
export class QwentFocusableDirective implements OnInit, OnChanges, OnDestroy {
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly focusService = inject(SpatialFocusService);
  private readonly parentScope = inject(QwentFocusScopeDirective, { optional: true });
  private focusId: string | null = null;

  @Input() qwentFocusGroup = 'default';
  @Input() qwentFocusScopeId: string | undefined;
  @Input({ transform: booleanAttribute }) qwentInitialFocus = false;

  @HostBinding('attr.tabindex')
  get customTabIndex(): string | null {
    const element = this.elementRef.nativeElement;
    if (['BUTTON', 'SELECT', 'INPUT', 'TEXTAREA'].includes(element.tagName)) return null;
    return element.hasAttribute('tabindex') ? null : '0';
  }

  ngOnInit(): void {
    this.focusId = this.focusService.register(
      this.elementRef.nativeElement,
      this.qwentFocusGroup,
      this.resolvedScopeId(),
      this.qwentInitialFocus,
    );
  }

  ngOnChanges(_changes: SimpleChanges): void {
    if (this.focusId) {
      this.focusService.updateEntry(
        this.focusId,
        this.qwentFocusGroup,
        this.resolvedScopeId(),
        this.qwentInitialFocus,
      );
    }
  }

  ngOnDestroy(): void {
    if (this.focusId) this.focusService.unregister(this.focusId);
  }

  @HostListener('focus')
  onFocus(): void {
    if (this.focusId) this.focusService.recordFocus(this.focusId);
  }

  private resolvedScopeId(): string | undefined {
    return this.qwentFocusScopeId ?? this.parentScope?.scopeId;
  }
}
