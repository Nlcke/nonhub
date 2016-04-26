/*
 * Nonhub server core v1.1.0
 * Author: Nikolay Yevstakhov aka N1cke
 * License: MIT
 */

exports.server = {

// can be adjusted in cfg.json (shared with cfg.lua)
debug: true,
version: "1.0.0",
maxMessageLength: 65535,
maxModeIndex: server => Object.keys(server.modes).length - 1,
modeIndexes: server => {
    var indexes = {}
    var i = 0
    for (var name in server.modes) indexes[name] = i++
    return indexes
},
modeLevels: server => {
    if (typeof server.modeIndexes === "function") return undefined
    var modes = server.modes
    var index = server.modeIndexes
    var levels = {}
    for (var name in index) {
        var level = modes[name].level
        if (server.UDP === true && level === 2) level = 3
        if (server.UDP === false && level === 3) level = 2
        levels[index[name]] = level
    }
    return levels        
},
// can be adjusted in cfg.json (strictly for server use)
modePaths: ["./node_modules/nonhub/modes/", "./modes/"],
clientCfgPath: "./cfg.lua",
UDP: null,
internalPort: 80,
port: server => process.env.PORT || server.internalPort,
maxConnections: 10000,
serverHandshake: "HTTP/1.1 101 Switching Protocols\r\nConnection: Upgrade\r\n",
// can be redefined only via core addon
startDate: () => 0,
network: () => null,
udpnetwork: () => null,
clients: () => ({}),
udpClients: () => ({}),
ids: () => ({}),
errorMessage: () => new Buffer([255, 0, 0]),
pongMessage: () => new Buffer([255, 255, 255]),
handshakeError: server => server.serverHandshake + "Protocol: Error\r\n\r\n",
modeHandlers: server => {
    if (typeof server.modeIndexes === "function") return undefined
    var modes = server.modes
    var index =server.modeIndexes
    var handlers = {}
    for (var name in modes) handlers[index[name]] = modes[name].handler
    return handlers
},
modeFinalizers: server => {
    var modes = server.modes
    var finalizers = []
    for (var name in modes) finalizers.push(modes[name].finalizer)
    return finalizers.filter(e => e.length > 0)
},
toLuaModule: () => function toLuaModule(obj, ind) {
    var str = ""
    ind === undefined ? ind = 0 : ind += 4
    str += ind > 0 ? "{\n" : "return {\n\n"
    for (var key in obj) {
        var val = obj[key]
        if (val === null) continue
        var isNumberKey = parseInt(key).toString() === key
        if (isNumberKey) key = "[" + key + "]"
        var isIdentifierKey = key.match(/^[a-zA-Z_][0-9a-zA-Z_]*$/)
        if (!isIdentifierKey && !isNumberKey) key = '["' + key + '"]'
        var t = typeof val
        var hasCode = t === "string" && val[0] === "'" && val.slice(-1) === "'"
        if (hasCode) val = val.slice(1, -1)
        str += " ".repeat(ind) + key + " = "
        if (t === "object") str += toLuaModule(val, ind)
        else if (t === "number" || t === "boolean") str += val + ",\n"
        else if (hasCode) str += val.trim().replace(/\n/g, "\n    ") + ",\n"
        else str += "\"" + val.toString() + "\",\n"
    }
    str += " ".repeat(ind > 0 ? ind - 4 : ind)
    ind > 0 ? str += "},\n" : str += "\n}"
    return str
},
clientBuilder: server => {
    var modes = server.modes
    var builders = {}
    modes.core = server.core
    for (var name in modes) for (var key in modes[name].client)
        if (typeof modes[name].client[key] === "function")
            builders[key] = modes[name].client[key]
    delete modes.core
    return builders
},
onUDPListen: server => function() {
    server.udpnetwork.setBroadcast(true)
    var address = server.udpnetwork.address();
    console.log("Nonhub UDP started on "+address.address+":"+address.port)
},
onUDPMessage: server => function(data, socket) {
    var udp = socket.address+":"+socket.port
    var client = server.udpClients[udp]
    if (client) return server.onMessage(client, data)
    var tcp = data.toString()
    var udpClient = server.clients[tcp]
    if (udpClient && !udpClient.udpport) {
        udpClient.udpport = socket.port
        udpClient.udpaddress = socket.address
        server.udpClients[udp] = udpClient
        if (server.debug) console.log(tcp+" connected to UDP on "+socket.port)
    }
},
onListen: server => function() {
    server.network.maxConnections = server.maxConnections
    server.startDate = Date.now()
    var n = server.network.address()
    console.log('Nonhub started on ' + n.address + ':' + n.port +
        ' at ' + Date(server.startDate))
},
onConnection: server => function(socket) {
    socket.on('data', function onHandshake(data) {
        if (data.toString().includes(server.version, 5)) {
            var ip = socket.remoteAddress + ':' + socket.remotePort
            if (server.clients[ip])
                return server.destroySocket(socket, 'same address')
            server.clients[ip] = Object.create(server.client)
            var client = server.clients[ip]
            client.socket = socket
            for (var key in server.clientBuilder)
                client[key] = server.clientBuilder[key](server)
            socket.setNoDelay(true)
            socket.removeListener('data', onHandshake)
            socket.on('data', data => server.onMessage(client, data))
            socket.write(server.serverHandshake + "UDPKey: " + ip  + "\r\n\r\n")
            if (server.debug) console.log(ip+" connected at "+ new Date())
        } else {
            socket.write(server.handshakeError)
            server.destroySocket(socket, "version mismatch")
        }
    })
    socket.on('error', e => server.destroySocket(socket, e.message))
},
onMessage: server => function(client, data) {
    var pos = 0 // data byte position
    var rem = data.length // data bytes remainder
    while (rem > 0) {switch (client.bufLen) {
        case 0:
            client.mode = data[pos]
            if (client.mode === 255) { // to keep alive
                client.socket.write(server.pongMessage)
                client.bufLen = 0; pos += 3; rem -= 3; break
            } else if (client.mode <= server.maxModeIndex) {
                ++client.bufLen; ++pos; --rem; break
            } else return server.destroySocket(client.socket, 'Error: mode')
        case 1:
           client.msgRem = data[pos] * 256
            ++client.bufLen; ++pos; --rem; break
        case 2:
            client.msgRem += data[pos]
            if (client.msgRem > server.maxMessageLength) 
                return server.destroySocket(client.socket, 'Error: length')
            ++client.bufLen; ++pos; --rem; break
        default:
            if (rem >= client.msgRem) { // full message
                if (server.modeLevels[client.mode] > 0 && client.id === 0) {
                    server.errorMessage[1] = client.mode
                    server.errorMessage[2] = 255 // indicates 'no id' error
                    client.socket.write(server.errorMessage)
                    client.bufLen = 0; pos += client.msgRem; rem -= client.msgRem
                    continue
                }
                data.copy(client.buf, client.bufLen, pos, pos + client.msgRem)
                client.bufLen += client.msgRem
                var error = server.modeHandlers[client.mode](client, server)
                if (error === undefined) { // normal message
                    client.buf[0] = client.mode // mode
                    client.buf.writeUInt16BE(client.bufLen-3, 1) // length
                    if (server.modeLevels[client.mode] >= 2) { // tcp broadcast
                        client.buf.writeUInt32BE(client.id, client.bufLen) // id
                        var msg = client.buf.slice(0, client.bufLen + 4)
                        var group = client.group
                        if (server.modeLevels[client.mode] === 3) {
                            for (var i in group) if (group[i].udpport) {
                                server.udpnetwork.send(msg, group[i].udpport,
                                    group[i].udpaddress)}
                        } else for (var i in group) group[i].socket.write(msg)
                        client.group = null
                    } else client.socket.write(client.buf.slice(0, client.bufLen))
                } else { // error message
                    server.errorMessage[1] = client.mode
                    server.errorMessage[2] = error
                    client.socket.write(server.errorMessage)
                }
                client.bufLen = 0; pos += client.msgRem; rem -= client.msgRem
            } else { // part of message
                data.copy(client.buf, client.bufLen, pos, pos + rem)
                client.bufLen += rem; client.msgRem -= rem; rem = 0
            }
        }
    }
},
destroySocket: server => function(socket, error) {
    var tcp = socket.remoteAddress + ':' + socket.remotePort
    var client = server.clients[tcp]
    if (client) {
        for (var finalizer of server.modeFinalizers) finalizer(client, server)
        var udp = socket.remoteAddress + ':' + server.clients[tcp].udpport
        delete server.clients[tcp]
        delete server.udpClients[udp]
    }
    socket.destroy()
    server.debug ? console.log(tcp + " disconnected at " + new Date() +
        " due to " + error) : null
}

}

exports.luacfg = {

// will be copied directly from server
debug: server => server.debug,
version: server => server.version,
maxModeIndex: server => server.maxModeIndex,
maxMessageLength: server => server.maxMessageLength, 
modeIndexes: server => server.modeIndexes,
modeLevels: server => server.modeLevels,
// can be adjusted in luacfg section of cfg.json
requiredModes: {},
autoReceive: true,
address: "localhost",
port: 80,
timeout: 5,
interval: 5,
maxRetries: 5,
maxUDPPackets: 60,
clientHandshake: "GET /%s HTTP/1.1\\r\\n" + "Host: %s\\r\\n" +
    "Upgrade: websocket\\r\\n" + "Connection: Upgrade\\r\\n\\r\\n",
onConnect: `'function(clientHS, serverHS) end'`,
onDisconnect: `'function(src, err) end'`,
on: {},
onError: {},
// will be calculated from modes
modeNames: server => {
    var index = server.modeIndexes
    var names = {}
    for (var name in index) names[index[name]] = name 
    return names
},
modePackers: server => {
    var modes = server.modes
    var packers = {}
    for (var name in modes) packers[name] = modes[name].packer
    return packers
},
modeUnpackers: server => {
    var modes = server.modes
    var unpackers = {}
    for (var name in modes) unpackers[name] = modes[name].unpacker
    return unpackers
},
modeErrors: server => {
    var modes = server.modes
    var errors = {}
    for (var name in modes) {
        errors[name] = modes[name].errors
        var idRequired = server.modeLevels[server.modeIndexes[name]] > 0
        if (idRequired) errors[name][255] = "not authorized"
    }
    return errors
},
luamodules: server => {
    var modes = server.modes
    var luamodules = {}
    for (var name in modes) for (var lm of modes[name].luamodules)
        luamodules[lm] = true
    return Object.keys(luamodules)
},
// cannot be redefined here (strictly for client app)
cfg: () => null,
connect: () => null,
disconnect: () => null,
send: () => null,
receive: () => null,
isConnected: () => null,
lastMessageTime: () => null,
socket: () => null,
buffer: () => null,
cache: () => null,
retries: () => null,
udpsocket: () => null,

}

exports.client = {

buf: server => new Buffer(server.maxMessageLength + 7),
socket: null,
udpport: null,
udpaddress: null,
id: 0,
group: null,
bufLen: 0,
mode: 0,
msgRem: 0,

}
