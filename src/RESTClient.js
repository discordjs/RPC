const superagent = require('superagent');
const { Endpoints } = require('./Constants');

module.exports = class RESTClient {
  constructor (client) {
    this.client = client;
  }

  makeRequest (method, path, body = {}, headers = {}) {
    return new Promise((resolve, reject) => {
      headers.Authorization = `Bearer ${this.client.accessToken}`;
      superagent[method.toLowerCase()](`https://${this.client.hostAndPort}${path}`)
      .set(headers).send(body).then(res => resolve(res.body), reject);
    });
  }

  sendMessage (channelID, content) {
    return this.makeRequest('post', Endpoints.channelMessages(channelID), { content });
  }

  editMessage (channelID, messageID, content) {
    return this.makeRequest('patch', Endpoints.channelMessage(channelID, messageID), { content });
  }

  deleteMessage (channelID, messageID) {
    return this.makeRequest('delete', Endpoints.channelMessage(channelID, messageID));
  }
}
