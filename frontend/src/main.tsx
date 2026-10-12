import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'
import AuthProvider from './components/AuthProvider.tsx'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60, retry: 1 },
  },
})

// HashRouter: GitHub Pages serves static files only, so deep links like
// /history would 404 on refresh with a path-based router.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </HashRouter>
    </QueryClientProvider>
  </StrictMode>,
)
