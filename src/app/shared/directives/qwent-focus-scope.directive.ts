import {
  booleanAttribute,
  Directive,
  ElementRef,
  HostBinding,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  inject,
  type SimpleChanges,
} from '@angular/core';
import { SpatialFocusService } from '../../services/spatial-focus.service';

@Directive({
  selector: '[qwentFocusScope]',
  standalone: true,
})
export class QwentFocusScopeDirective implements OnInit, OnChanges, OnDestroy {
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly focusService = inject(SpatialFocusService);
  private registeredScopeId: string | null = null;

  @Input({ alias: 'qwentFocusScope', required: true }) scopeId!: string;
  @Input({ transform: booleanAttribute }) qwentTrapFocus = true;
  @Input() qwentFocusGroup: string | undefined;

  @HostBinding('attr.data-qwent-focus-scope')
  get focusScopeAttribute(): string {
    return this.scopeId;
  }

  ngOnInit(): void {
    this.elementRef.nativeElement.setAttribute('data-qwent-focus-scope', this.scopeId);
    this.registeredScopeId = this.scopeId;
    this.focusService.openScope(this.focusScope());
  }

  ngOnChanges(_changes: SimpleChanges): void {
    if (this.registeredScopeId) {
      this.elementRef.nativeElement.setAttribute('data-qwent-focus-scope', this.scopeId);
      this.focusService.updateScope(this.focusScope());
    }
  }

  private focusScope(): { readonly id: string; readonly trapsFocus: boolean; readonly focusGroup?: string } {
    return {
      id: this.scopeId,
      trapsFocus: this.qwentTrapFocus,
      ...(this.qwentFocusGroup ? { focusGroup: this.qwentFocusGroup } : {}),
    };
  }

  ngOnDestroy(): void {
    if (this.registeredScopeId) this.focusService.closeScope(this.registeredScopeId);
  }
}
