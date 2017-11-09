function pid() {
  if (typeof process !== undefined) {
    return process.pid;
  }
  return null;
}

module.exports = {
  pid,
};
