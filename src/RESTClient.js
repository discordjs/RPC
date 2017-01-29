const superagent = require('superagent');
const { Endpoints } = require('./Constants');

module.exports = class RESTClient {
  constructor(client) {
    this.client = client;
  }

  makeRequest(method, path, body = {}, headers = {}) {
    headers.Authorization = `Bearer ${this.client.accessToken}`;
    return superagent[method.toLowerCase()](`https://${this.client.hostAndPort}${path}`)
    .set(headers).send(body)
    .then(res => res.body);
  }

  sendMessage(channelID, content) {
    return this.makeRequest('post', Endpoints.channelMessages(channelID), { content });
  }

  editMessage(channelID, messageID, content) {
    return this.makeRequest('patch', Endpoints.channelMessage(channelID, messageID), { content });
  }

  deleteMessage(channelID, messageID) {
    return this.makeRequest('delete', Endpoints.channelMessage(channelID, messageID));
  }
};
