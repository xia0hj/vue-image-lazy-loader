import createLazyDirective from './create-lazy-directive'

export default {
  install (app, options) {
    app.directive('lazy', createLazyDirective(options))
  }
}
