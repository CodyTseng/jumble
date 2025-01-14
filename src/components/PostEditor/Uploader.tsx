import { useToast } from '@/hooks/use-toast'
import { useNostr } from '@/providers/NostrProvider'
import { useRef } from 'react'
import { z } from 'zod'

export default function Uploader({
  children,
  onUploadSuccess,
  onUploadingChange,
  className,
  accept = 'image/*'
}: {
  children: React.ReactNode
  onUploadSuccess: ({ url, tags }: { url: string; tags: string[][] }) => void
  onUploadingChange?: (uploading: boolean) => void
  className?: string
  accept?: string
}) {
  const { signHttpAuth } = useNostr()
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const formData = new FormData()
    formData.append('file', file)

    try {
      onUploadingChange?.(true)
      const url = 'https://nostr.build/api/v2/nip96/upload'
      const auth = await signHttpAuth(url, 'POST')
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
        headers: {
          Authorization: auth
        }
      })

      if (!response.ok) {
        throw new Error(response.status.toString())
      }

      const data = await response.json()
      const tags = z.array(z.array(z.string())).parse(data.nip94_event?.tags ?? [])
      const imageUrl = tags.find(([tagName]) => tagName === 'url')?.[1]
      if (imageUrl) {
        onUploadSuccess({ url: imageUrl, tags })
      } else {
        throw new Error('No image url found')
      }
    } catch (error) {
      console.error('Error uploading file', error)
      toast({
        variant: 'destructive',
        title: 'Failed to upload file',
        description: (error as Error).message
      })
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } finally {
      onUploadingChange?.(false)
    }
  }

  const handleUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '' // clear the value so that the same file can be uploaded again
      fileInputRef.current.click()
    }
  }

  return (
    <div onClick={handleUploadClick} className={className}>
      {children}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleFileChange}
        accept={accept}
      />
    </div>
  )
}
