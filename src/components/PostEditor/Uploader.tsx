import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { useNostr } from '@/providers/NostrProvider'
import { ImageUp, LoaderCircle } from 'lucide-react'
import { useRef, useState } from 'react'
import { z } from 'zod'

export default function Uploader({
  setContent
}: {
  setContent: React.Dispatch<React.SetStateAction<string>>
}) {
  const [uploading, setUploading] = useState(false)
  const { signHttpAuth } = useNostr()
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const formData = new FormData()
    formData.append('file', file)

    try {
      setUploading(true)
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
        setContent((prevContent) => `${prevContent}\n${imageUrl}`)
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
      setUploading(false)
    }
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  return (
    <>
      <Button variant="secondary" onClick={handleUploadClick} disabled={uploading}>
        {uploading ? <LoaderCircle className="animate-spin" /> : <ImageUp />}
      </Button>
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleFileChange}
        accept="image/*,video/*,audio/*"
      />
    </>
  )
}
