function pid() {
  if (typeof process !== undefined)
    return process.pid;

  return null;
}

const has = Function.prototype.call.bind(Object.prototype.hasOwnProperty);

function inferClass(client, object) {
  if (has(object, 'avatar'))
    return client.users.create(object);

  return object;
}

function inferClasses(client, obj) {
  if (obj && typeof obj === 'object') {
    const copy = {};
    for (let [key, value] of Object.entries(obj)) {
      if (Array.isArray(value))
        value = value.map((v) => inferClasses(client, v));
      else if (value && typeof value === 'object')
        value = inferClasses(client, value);
      copy[key] = inferClass(client, value);
    }
    return copy;
  } else {
    return obj;
  }
}

module.exports = {
  pid,
  inferClass,
  inferClasses,
};
