import { ElectronPool } from '@/lib/electron-pool'
import { getElectronBridge, isElectron } from '@/lib/platform'
import { SmartPool } from '@/lib/smart-pool'
import type { IRelayPool } from '@/types/relay-pool'
import type { Event, Filter } from 'nostr-tools'
import { Observable, Subscription, firstValueFrom, toArray } from 'rxjs'

let transport: IRelayPool | undefined
function getTransport() {
  // Dedicated, signer-free transport. Never borrow the current account's AUTH handler.
  return (transport ??=
    isElectron() && getElectronBridge()
      ? new ElectronPool(() => undefined, { handleAuthRequests: false })
      : new SmartPool())
}

type RelayMessage = {
  type: 'EVENT' | 'EOSE' | 'CLOSED'
  from: string
  event?: Event
  reason?: string
}

/** NAP transport adapter backed by Jumble’s web/main-process relay pools. */
export class RelayPool {
  private subscriptions = new Subscription()
  private dead = false

  req(urls: string[], filters: Filter[], _options?: unknown): Observable<RelayMessage> {
    return new Observable((observer) => {
      if (this.dead) {
        observer.complete()
        return
      }
      const group = new Subscription()
      this.subscriptions.add(group)
      for (const from of urls) {
        void getTransport()
          .ensureRelay(from)
          .then(
            (relay) => {
              if (group.closed || this.dead) return
              const sub = relay.subscribe(filters, {
                onevent: (event) => observer.next({ type: 'EVENT', from, event }),
                oneose: () => observer.next({ type: 'EOSE', from }),
                onclose: (reason) => observer.next({ type: 'CLOSED', from, reason })
              })
              group.add(() => sub.close())
            },
            (error: unknown) => {
              if (!group.closed) observer.next({ type: 'CLOSED', from, reason: String(error) })
            }
          )
      }
      return () => group.unsubscribe()
    })
  }

  relay(from: string) {
    return {
      event: (event: Event) =>
        new Observable<{ ok: boolean; from: string; message?: string }>((observer) => {
          if (this.dead) {
            observer.error(new Error('Session closed'))
            return
          }
          const task = new Subscription()
          this.subscriptions.add(task)
          void getTransport()
            .ensureRelay(from)
            .then(async (relay) => {
              if (task.closed || this.dead) return
              await relay.publish(event)
              if (!task.closed) {
                observer.next({ ok: true, from })
                observer.complete()
              }
            })
            .catch((error: unknown) => {
              if (!task.closed) {
                observer.next({ ok: false, from, message: String(error) })
                observer.complete()
              }
            })
          return () => task.unsubscribe()
        })
    }
  }

  async publish(urls: string[], event: Event, _options?: unknown) {
    return (
      await Promise.all(
        urls.map((url) => firstValueFrom(this.relay(url).event(event).pipe(toArray())))
      )
    ).flat()
  }

  close() {
    this.dead = true
    this.subscriptions.unsubscribe()
  }
}
