'use strict';

const LobbyTypes = {
  PRIVATE: 1,
  PUBLIC: 2,
};

const patch = (lobby, data) => {
  lobby.id = data.id;

  lobby.capacity = data.capacity;

  lobby.members = data.members.map(({ metadata, user }) => {
    const u = lobby.client.users.create(user);
    return { metadata, user: u };
  });

  lobby.metadata = data.metadata;

  lobby.ownerId = data.owner_id;
  lobby.owner = lobby.client.users.get(data.owner_id);

  lobby.secret = data.secret;

  lobby.type = Object.keys(LobbyTypes)[data.type - 1];
};

class Lobby {
  constructor(client, data) {
    this.client = client;

    patch(this, data);
  }

  async send(...args) {
    await this.client.sendToLobby(this, ...args);
    return this;
  }

  disconnect(...args) {
    return this.client.disconnectFromLobby(this, ...args);
  }

  async update(...args) {
    const d = await this.client.updateLobby(this, ...args);
    patch(this, d);
    return this;
  }

  delete(...args) {
    return this.client.deleteLobby(this, ...args);
  }
}

Lobby.Types = LobbyTypes;

module.exports = Lobby;
