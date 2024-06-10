import { ReactiveController, ReactiveControllerHost } from "lit";
import { Observable, Subscription } from "rxjs";

export type Provider<T> = () => T;

export function subscribe<T>(
  host: ReactiveControllerHost & HTMLElement,
  provider: Provider<Observable<T>>,
  callback: (t: T) => void
) {
  if (host.isConnected) throw new Error("component is already connected");
  host.addController(new SubscriptionController(provider, callback));
}

export class SubscriptionController<T> implements ReactiveController {
  private sub?: Subscription;

  constructor(
    private readonly provider: Provider<Observable<T>>,
    private readonly callback: (t: T) => void
  ) {}

  hostConnected() {
    this.sub = this.provider().subscribe((v) => this.update(v));
  }

  update(value: T) {
    this.callback(value);
  }

  hostDisconnected() {
    this.sub?.unsubscribe();
  }
}
