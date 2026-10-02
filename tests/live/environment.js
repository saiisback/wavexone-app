/**
 * The preset's environment, plus Node's own `fetch`.
 *
 * The React Native preset replaces `fetch` with a stub that never reaches
 * the network, which is right for unit tests and useless here. Node's real
 * one is handed across before the preset's setup files run; `setup.ts` puts
 * it back once they have.
 */
const ReactNativeEnv = require('@react-native/jest-preset/jest/react-native-env')

module.exports = class LiveEnvironment extends ReactNativeEnv {
  constructor(config, context) {
    super(config, context)
    this.global.__nodeFetch = fetch
  }
}
