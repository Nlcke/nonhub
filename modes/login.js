module.exports = {

name: "login",
author: "N1cke",
version: "1.0.0",
description: "Simple login system, accepts any username.",
nodemodules: [],
nonhubmodes: [],
luamodules: [],
packer: `'function(message, client) return tostring(message) end'`,
unpacker: `'function(data, client) return data end'`,
client: {
    username: null,
},
server: {
    idsCounter: cfg => 0,
    idsReserved: cfg => [],
},
luacfg: {},
handler: function(client, server) {
    client.username = client.buf.toString("utf8", 3, client.bufLen)
    if (client.id) return undefined
    client.id = server.idsReserved.pop() || ++server.idsCounter
    server.ids[client.id] = client
},
finalizer: function(client, server) {
    if (client.id) {
        server.idsReserved.push(client.id)
        delete server.ids[client.id]
    }
},
errors: {},
level: 0,

}