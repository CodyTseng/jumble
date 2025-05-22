import { Helmet } from 'react-helmet-async'

export default function SEO ({
  title,
  description,
  image,
  url,
  type = 'website',
  siteName = 'https://jumble.social',
}: {
    title: string
    description: string
    image: string
    url: string
    type?: 'website'
    siteName?: string
  }) {
  const siteUrl = 'https://jumble.social'
  
  const seo = {
    title: title ? `${title} | ${siteName}` : siteName,
    description: description || 'Default description for your website',
    image: image ? 
      (image.startsWith('http') ? image : `${siteUrl}${image}`) : 
      `${siteUrl}/default-og-image.jpg`,
    url: url ? `${siteUrl}${url}` : siteUrl,
  }

  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{seo.title}</title>
      <meta name="description" content={seo.description} />
      
      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={seo.title} />
      <meta property="og:description" content={seo.description} />
      <meta property="og:image" content={seo.image} />
      <meta property="og:url" content={seo.url} />
      <meta property="og:site_name" content={siteName} />
      
      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={seo.title} />
      <meta name="twitter:description" content={seo.description} />
      <meta name="twitter:image" content={seo.image} />
      
      {/* Canonical URL */}
      <link rel="canonical" href={seo.url} />
    </Helmet>
  )
}
