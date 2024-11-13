import './assets/main.css'

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import Web from './Web'
import { IS_ELECTRON } from './lib/env'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>{IS_ELECTRON ? <App /> : <Web />}</React.StrictMode>
)
