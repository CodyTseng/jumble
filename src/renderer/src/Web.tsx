import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import App from './App'
import BlankPage from './pages/secondary/BlankPage'
import { ROUTES } from './routes'

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [{ index: true, element: <BlankPage /> }, ...ROUTES]
  }
])

export default function Web() {
  return <RouterProvider router={router} />
}
