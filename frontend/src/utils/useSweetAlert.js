/**
 * Unified SweetAlert2 utility.
 *
 *  swal.toast.success / error / warning / info  — short-lived slide-in toasts
 *  swal.alert.success / error / warning / info  — dismissible centred dialogs
 *  swal.confirm(title, message, opts?)          — promise-based yes/no dialog
 *
 * alert.error and alert.warning accept an optional `details` array of strings
 * that are rendered as a bullet list beneath the main message.
 */
import Swal from 'sweetalert2'

// ─── Toast mixin ────────────────────────────────────────────────────────────

const ToastMixin = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 6000,
  timerProgressBar: true,
  didOpen: (el) => {
    el.onmouseenter = Swal.stopTimer
    el.onmouseleave = Swal.resumeTimer
  },
})

const toast = {
  success: (message, opts = {}) => ToastMixin.fire({ icon: 'success', title: message, ...opts }),
  error: (message, opts = {}) => ToastMixin.fire({ icon: 'error', title: message, timer: 6000, ...opts }),
  warning: (message, opts = {}) => ToastMixin.fire({ icon: 'warning', title: message, ...opts }),
  info: (message, opts = {}) => ToastMixin.fire({ icon: 'info', title: message, ...opts }),
}

// ─── Alert helpers ──────────────────────────────────────────────────────────

/**
 * Build HTML body from a message string and an optional details array.
 * @param {string} message
 * @param {Array<string|{message:string}>} [details]
 */
const buildHtml = (message, details) => {
  const list = details?.length
    ? `<ul style="text-align:left;margin:10px 0 0;padding-left:20px">${details
        .map((d) => `<li>${typeof d === 'string' ? d : d.message}</li>`)
        .join('')}</ul>`
    : ''
  return `<p style="margin:0">${message}</p>${list}`
}

const alert = {
  success: (title, message, opts = {}) =>
    Swal.fire({
      icon: 'success',
      title,
      html: buildHtml(message),
      confirmButtonText: 'OK',
      ...opts,
    }),

  error: (title, message, details, opts = {}) =>
    Swal.fire({
      icon: 'error',
      title,
      html: buildHtml(message, details),
      confirmButtonText: 'Dismiss',
      confirmButtonColor: '#e55353',
      ...opts,
    }),

  warning: (title, message, details, opts = {}) =>
    Swal.fire({
      icon: 'warning',
      title,
      html: buildHtml(message, details),
      confirmButtonText: 'OK',
      ...opts,
    }),

  info: (title, message, opts = {}) =>
    Swal.fire({
      icon: 'info',
      title,
      html: buildHtml(message),
      confirmButtonText: 'OK',
      ...opts,
    }),
}

// ─── Confirm dialog ─────────────────────────────────────────────────────────

/**
 * Promise-based confirmation dialog.
 * @returns {Promise<boolean>} true if confirmed, false if cancelled.
 */
const confirm = (title, message, opts = {}) =>
  Swal.fire({
    icon: 'question',
    title,
    html: buildHtml(message),
    showCancelButton: true,
    confirmButtonText: opts.confirmText ?? 'Confirm',
    cancelButtonText: opts.cancelText ?? 'Cancel',
    reverseButtons: true,
    ...opts,
  }).then((r) => r.isConfirmed)

// ─── Public API ─────────────────────────────────────────────────────────────

const swal = { toast, alert, confirm }

export default swal
