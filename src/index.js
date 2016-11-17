module.exports = {
  version: require('../package.json').version,
  Client: require('./RPCClient'),
  Rest: require('./RESTClient'),
  Constants: require('./Constants')
}
