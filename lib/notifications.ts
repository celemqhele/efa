export function notify(title: string, message: string, type: 'result' | 'sacked' | 'hired' | 'admin' = 'admin') {
  window.dispatchEvent(new CustomEvent('show-notification', { detail: { title, message, type } }))
}
