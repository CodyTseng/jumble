import { useToast } from '@/hooks/use-toast'
import { useMediaUploadService } from '@/providers/MediaUploadServiceProvider'
import { useRef } from 'react'

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
  const { toast } = useToast()
  const { upload } = useMediaUploadService()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      onUploadingChange?.(true)
      const result = await upload(file)
      console.log('File uploaded successfully', result)
      onUploadSuccess(result)
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
