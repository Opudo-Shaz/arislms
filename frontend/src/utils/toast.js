/**
 * Thin wrapper around SweetAlert2 Toast for short-lived slide-in notifications.
 * Usage:
 *   toast.success('Loan created!')
 *   toast.error('Something went wrong.')
 *   toast.warning('Check your input.')
 */
import Swal from 'sweetalert2'

const Toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 6000,
  timerProgressBar: true,
  didOpen: (t) => {
    t.onmouseenter = Swal.stopTimer
    t.onmouseleave = Swal.resumeTimer
  },
})

const toast = {
  success: (message, opts = {}) =>
    Toast.fire({ icon: 'success', title: message, ...opts }),

  error: (message, opts = {}) =>
    Toast.fire({ icon: 'error', title: message, timer: 6000, ...opts }),

  warning: (message, opts = {}) =>
    Toast.fire({ icon: 'warning', title: message, ...opts }),

  info: (message, opts = {}) =>
    Toast.fire({ icon: 'info', title: message, ...opts }),
}

export default toast
