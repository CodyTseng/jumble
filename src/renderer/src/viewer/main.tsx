import 'yet-another-react-lightbox/styles.css'
import '../assets/main.css'

import { ThemeProvider } from '@renderer/components/theme-provider'
import { Toaster } from '@renderer/components/ui/toaster'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { PageManager } from '../PageManager'
import NoteListPage from '../pages/primary/NoteListPage'
import HashtagPage from '../pages/secondary/HashtagPage'
import NotePage from '../pages/secondary/NotePage'
import ProfilePage from '../pages/secondary/ProfilePage'

const routes = [
  { pageName: 'note', element: <NotePage /> },
  { pageName: 'profile', element: <ProfilePage /> },
  { pageName: 'hashtag', element: <HashtagPage /> }
]

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <Viewer />
  </React.StrictMode>
)

function Viewer(): JSX.Element {
  return (
    <div className="h-screen">
      <ThemeProvider>
        <PageManager routes={routes}>
          <NoteListPage />
        </PageManager>
        <Toaster />
      </ThemeProvider>
    </div>
  )
}
