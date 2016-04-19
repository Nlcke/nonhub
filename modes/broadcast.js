module.exports = {

name: "broadcast",
author: "N1cke",
version: "1.0.0",
description: "Simple broadcasting to all connected players.",
nodemodules: [],
nonhubmodes: [],
luamodules: [],
packer: `'function(message, client) return tostring(message) end'`,
unpacker: `'function(data, client) return data end'`,
client: {},
server: {fs: () => require('fs')}, // example of shared node module
luacfg: {},
handler: function(client, server) {client.group = server.clients},
finalizer: function() {},
errors: {},
level: 2,

}