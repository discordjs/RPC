class PartialUser {
  constructor(attributes) {
    this.id = attributes.id;
    this.username = attributes.username;
    this.discriminator = attributes.discriminator;
    this.avatar = attributes.avatar;
  }
}

module.exports = PartialUser;