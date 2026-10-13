import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import { consumeGoogleRedirect } from './lib/googleAuth'
import App from './App.tsx'
import AuthProvider from './components/AuthProvider.tsx'
import PreferencesProvider from './components/PreferencesProvider.tsx'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60, retry: 1 },
  },
})

// Must run before HashRouter sees Google's #id_token=… fragment.
consumeGoogleRedirect()

// HashRouter: GitHub Pages serves static files only, so deep links like
// /history would 404 on refresh with a path-based router.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <AuthProvider>
          <PreferencesProvider>
            <App />
          </PreferencesProvider>
        </AuthProvider>
      </HashRouter>
    </QueryClientProvider>
  </StrictMode>,
)
