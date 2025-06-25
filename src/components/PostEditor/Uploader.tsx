import mediaUpload from '@/services/media-upload.service'
import { useRef } from 'react'
import { toast } from 'sonner'

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
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files) return

    onUploadingChange?.(true)
    try {
      for (const file of event.target.files) {
        const result = await mediaUpload.upload(file)
        onUploadSuccess(result)
      }
    } catch (error) {
      console.error('Error uploading file', error)
      toast.error(`Failed to upload file: ${(error as Error).message}`)
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
        multiple
      />
    </div>
  )
}
