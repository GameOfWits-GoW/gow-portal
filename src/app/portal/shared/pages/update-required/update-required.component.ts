import { Component } from '@angular/core'

@Component({
  selector: 'gow-update-required-page',
  templateUrl: './update-required.component.html'
})
export class UpdateRequiredPageComponent {
  public async refresh(): Promise<void> {
    try {
      if ('caches' in window) {
        const cacheNames = await caches.keys()
        await Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)))
      }
    } finally {
      window.location.reload()
    }
  }
}
