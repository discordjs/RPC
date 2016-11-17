const superagent = require('superagent');

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

  sendMessage (channelId, content) {
    return this.makeRequest('post', `/channels/${channelId}/messages`, { content });
  }

  editMessage (channelId, messageId, content) {
    return this.makeRequest('patch', `/channels/${channelId}/messages/${messageId}`, { content });
  }

  deleteMessage (channelId, messageId) {
    return this.makeRequest('delete', `/channels/${channelId}/messages/${messageId}`);
  }
}
