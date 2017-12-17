let register;
try {
  const { app } = require('electron');
  register = app.setAsDefaultProtocolClient.bind(app);
} catch (err) {
  try {
    register = require('register-scheme');
  } catch (e) {} // eslint-disable-line no-empty
}

if (typeof register !== 'function')
  register = () => false;

function pid() {
  if (typeof process !== undefined)
    return process.pid;

  return null;
}
module.exports = {
  pid,
  register,
};
