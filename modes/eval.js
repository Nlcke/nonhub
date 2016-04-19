module.exports = {

name: "eval",
author: "N1cke",
version: "1.0.0",
description: "Evaluates an expression on the server and sends the result back.",
nodemodules: [],
nonhubmodes: [],
luamodules: [],
packer: `'function(message, client) return tostring(message) end'`,
unpacker: `'function(data, client) return data end'`,
client: {},
server: {},
luacfg: {},
handler: function(client, server) {
    const s = client.buf.toString("utf8", 3, client.bufLen)
    try {var r = require('util').inspect(eval(s))} catch (e) {var r = e.message}
    r = r === undefined ? "undefined" : r
    if (r.length > server.maxMessageLength)  r = r.slice(0, server.maxMessageLength)
    client.buf.write(r, 3)
    client.bufLen = 3 + r.length
},
finalizer: function() {},
errors: {},
level: 0,


}