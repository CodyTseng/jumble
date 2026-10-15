// Trusted, static carrier only. Untrusted HTML always belongs to the inner opaque iframe.
// Keeping this document separate prevents srcdoc from inheriting the application's script CSP.
const frame = document.querySelector('iframe')
window.jumbleNappletHost = Object.freeze({
  frame,
  // This function's realm is the carrier, so the child sees its actual parent as sender.
  send(message) {
    frame.contentWindow?.postMessage(message, '*')
  }
})
