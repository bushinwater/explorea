import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ChatBubbleService {
  private openWithMessage$ = new Subject<string>();

  readonly trigger$ = this.openWithMessage$.asObservable();

  openWithMessage(message: string): void {
    this.openWithMessage$.next(message);
  }
}
