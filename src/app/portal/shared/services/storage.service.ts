import { Injectable, inject } from '@angular/core'
import {
  deleteObject,
  getDownloadURL,
  ref,
  Storage,
  uploadBytes
} from '@angular/fire/storage'

@Injectable({ providedIn: 'root' })
export class StorageService {
  private readonly storage = inject(Storage)

  public async upload(
    path: string,
    file: Blob | Uint8Array | ArrayBuffer,
    metadata?: { [key: string]: string },
    beforeUpload?: () => Promise<void>
  ): Promise<string> {
    const fileRef = ref(this.storage, path)
    await beforeUpload?.()
    await uploadBytes(fileRef, file, metadata)
    return path
  }

  public async delete(path: string): Promise<void> {
    await deleteObject(ref(this.storage, path))
  }

  public async downloadUrl(path: string): Promise<string> {
    const storageRef = ref(this.storage, path)
    return await getDownloadURL(storageRef)
  }
}
