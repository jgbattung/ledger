import { useLocation, useNavigate } from 'react-router-dom'

/**
 * Back that also works on a cold deep link: history when there is some
 * (the first entry has the key "default"), otherwise a replace to `fallback`.
 */
export function useGoBack(fallback = '/workout') {
  const navigate = useNavigate()
  const location = useLocation()
  return () => {
    if (location.key !== 'default') navigate(-1)
    else navigate(fallback, { replace: true })
  }
}
