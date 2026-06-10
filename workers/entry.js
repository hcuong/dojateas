import handler from '../dist/server/server.js'

export default {
  fetch(request) {
    return handler.fetch(request)
  },
}
