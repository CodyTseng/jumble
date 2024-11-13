import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import App from './App'
import { ROUTES } from './routes'
import BlankPage from './pages/secondary/BlankPage'

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
