function camelCaseObject(obj) {
  if (obj && typeof obj === 'object') {
    const copy = {};
    for (let [key, value] of Object.entries(obj)) {
      if (Array.isArray(value)) value = value.map((v) => camelCaseObject(v));
      else if (value && typeof value === 'object') value = camelCaseObject(value);
      copy[key.replace(/_(.)/g, (_, c) => c.toUpperCase())] = value;
    }
    return copy;
  } else {
    return obj;
  }
}

function snakeCaseObject(obj) {
  if (obj && typeof obj === 'object') {
    const copy = {};
    for (let [key, value] of Object.entries(obj)) {
      if (Array.isArray(value)) value = value.map((v) => snakeCaseObject(v));
      else if (value && typeof value === 'object') value = snakeCaseObject(value);
      copy[key.replace(/([A-Z])/g, (_, c) => `_${c.toLowerCase()}`)] = value;
    }
    return copy;
  } else {
    return obj;
  }
}

module.exports = {
  camelCaseObject,
  snakeCaseObject,
};
