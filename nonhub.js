/*
 * Nonhub server loader v1.1.0
 * Author: Nikolay Yevstakhov aka N1cke
 * License: MIT
 */

"use strict"

const modeTemplate = `module.exports = {

name: "",
author: "",
version: "1.0.0",
description: \`\`,
nodemodules: [],
nonhubmodes: [],
luamodules: [],
packer: \`'tostring'\`,
unpacker: \`'tostring'\`,
client: {},
server: {},
luacfg: {},
handler: function(client, server) {},
finalizer: function(client, server) {},
errors: {},
level: 0,

}`

function isEmpty(obj) {for (let x in obj) {return false}; return true}

function pushUnique(array, elements) {
    let args = Array.prototype.slice.call(arguments, 1)
    for (let arg of args) {
        let unique = true
        for (let elem of array) if (arg === elem) {unique = false; break}
        if (unique) array.push(arg)
    }
    return array
}

function sortObjectKeys(obj) {
    for (let key of Object.keys(obj).sort()) {
        let val = obj[key]
        delete obj[key]
        obj[key] = val
    }    
}

const core = require('./core')
try {var settings = require.main.require('./settings.json')} catch (e) {settings = {}}
try {var modescfg = require.main.require('./modes.json')} catch (e) {modescfg = {}}

const modes = function loadModes() {
    let modes = {}
    settings.modePaths = settings.modePaths || core.server.modePaths
    for (let path of settings.modePaths) {
        try {var modePath = require('fs').realpathSync(path)+"/"
        } catch (e) {
            console.info("settings.json/modePaths: '"+path+"' not found")
            continue
        }
        let modeNames = require('fs').readdirSync(modePath)
        for (let fullname of modeNames) {
            let basename = require('path').basename(fullname, ".js")
            let path = modePath + fullname
            let mode = require(path)
            let name = typeof mode.name === "string" ? mode.name : basename
            if (isEmpty(mode) && name !== "core") {
                require('fs').writeFileSync(path,
                    modeTemplate.replace('name: ""', 'name: "'+name+'"'))
                delete require.cache[require.resolve(path)]
                modes[name] = require(path)
                console.info("mode '"+name+"' created from mode template")
            } else if (isEmpty(mode) && name === "core") {
                require('fs').writeFileSync(path,
                    require('fs').readFileSync('./core.js'))
                console.info("core update '"+fullname+"' created from core template")
            } else modes[name] = mode
        }
    }
    return modes
}()

function modescfgUpdate() {
    let newModes = {}
    for (let name in modes) if (modescfg[name] === undefined)
        newModes[name] = true
    if (!isEmpty(newModes)) {
        console.warn("modes.json: new modes added and enabled:")
        for (let name in newModes) {
            console.log("• "+name)
            modescfg[name] = true
        }
    }
    for (let name in modescfg) {
        if (modes[name] === undefined) delete modescfg[name]
        if (!modescfg[name]) delete modes[name]
    }
    if (modes.core) {
        for (let key in modes.core) if (modes.core[key] !== undefined)
            core[key] = modes.core[key]
        delete modes.core
    }
    require('fs').writeFileSync("./modes.json",
        JSON.stringify(modescfg, null, 4))
}
modescfgUpdate()

let modeValidators = {}

modeValidators["Incorrect Sections"] = function() {
    let template = eval(modeTemplate)
    let types = {}
    for (let section in template) {
        let t = typeof template[section]
        let array = Array.isArray(template[section])
        types[section] = t === "object" ? (array ? "array" : "hash" ) : t
    }
    
    let errors = {}
    for (let name in modes) for (let section in template) {
        let s = modes[name][section]
        let t = typeof s
        if (t === "object") t = Array.isArray(s) ? "array" : "hash" 
        if (t !== types[section]) {
            let sec = section+" :: "+types[section]
            errors[sec] = pushUnique(errors[sec] || [], name)
            modes[name][section] = template[section]
        }
    }
    return errors
}

modeValidators["Missing Nonhub Modes"] = function() {
    let errors = {}
    for (let name in modes) {
        let nonhubmodes = modes[name].nonhubmodes
        for (let key in nonhubmodes) {
            let val = nonhubmodes[key]
            if (!modes[val]) errors[val] = pushUnique(errors[val] || [], name)
        }
    }
    return errors
}
modeValidators["Missing Node Modules"] = function() {
    let errors = {}
    let nodemodules = []
    for (let name in modes) for (let key of modes[name].nodemodules)
        try {require(key)
        } catch (e) {errors[key] = pushUnique(errors[key] || [],  name)}
    return errors
}

modeValidators["Undefined Section Keys"] = function() {
    let errors = {}
    for (let section in core)
        for (let name in modes) {
            let keys = modes[name][section]
            for (let key in keys) if (keys[key] === undefined) {
                if (core[section][key] !== undefined) continue
                let notFound = true
                for (let nameX of modes[name].nonhubmodes)
                    if (!modes[nameX]) continue
                    else if (modes[nameX][section][key] !== undefined)
                        {notFound = false; break}
                if (notFound) errors[section+" -> "+key] = pushUnique(
                    errors[key] || [], name)
            }
        }
    return errors
}

modeValidators["Conflicting Section Keys"] = function() {
    modes.core = core
    let errors = {}
    for (let section in core)
        for (let name in modes)
            for (let key in modes[name][section])
                if (modes[name][section][key] !== undefined)
                    for (let nameX in modes) if (nameX !== name)
                        if (modes[nameX][section][key] !== undefined)
                            errors[section+" -> "+key] = pushUnique(
                                errors[key] || [], name, nameX)
    delete modes.core
    return errors
}

function validateModes() {
    let errors = {}
    for (let key in modeValidators) errors[key] = modeValidators[key]()
    for (let key in errors) if (isEmpty(errors[key])) delete errors[key]

    if (Object.keys(errors).length > 0) {
        for (let name in errors) {
            console.log(name)
            for (let key in errors[name]) {
                console.log("  ► "+key)
                for (let val of errors[name][key]) console.log("    • "+val)
            }
        }
        throw new Error("Error: some modes cannot be loaded (check README for tips)")
    }    
}
validateModes()

let server = function() { // creates server object and updates settings and cfg
    let server = {}
    
    modes.core = core
    for (let name in modes) for (let key in modes[name].server)
        server[key] = settings[key] !== undefined ?
            settings[key]: modes[name].server[key]
    sortObjectKeys(server)
    
    require('fs').writeFileSync("./settings.json", JSON.stringify(server, null, 4))
    
    for (let section of ['luacfg', 'client']) {
        server[section] = {}
        for (let name in modes) for (let key in modes[name][section])
                server[section][key] = modes[name][section][key]
    }
    sortObjectKeys(server.luacfg)
    
    server.core = core
    server.modes = modes
    delete modes.core
    
    for (let cfg of [server, server.luacfg]) {
        let functions = {}
        for (let key in cfg) if (typeof cfg[key] === "function")
            functions[key] = cfg[key]

        let rem = [Object.keys(functions).length]
        while (rem[0] !== rem[1]) {
            for (let key in functions) {
                let result = functions[key](server)
                if (result !== undefined) {cfg[key] = result; delete functions[key]}
            }
            rem.unshift(Object.keys(functions).length)
        }

        if (Object.keys(functions).length > 0) {
            let cfgname = cfg == server ? "server" : "luacfg"
            for (let key in functions)
                if (core.server[key] || core.luacfg[key]) console.log("core -> "+key)
                else for (let name in modes)
                    if (modes[name].server[key] || modes[name].luacfg[key])
                        console.log(name+" -> server -> "+key)
            throw new Error("Error: functions from "+cfgname+
                " section return 'undefined'")
        }
    }

    require('fs').writeFile(server.clientCfgPath, server.toLuaModule(server.luacfg),
        e => e ? console.log("Error: cannot write luacfg ("+e.message+")") : null)
    
    if (server.maxModeIndex > 254)
        throw new Error("modes number is over 255 (disable some of them in modes.json)")
    
    return server
}()

if (server.debug) console.log("[settings.json]\n", settings)

server.network = require('net').createServer(server.onConnection)
server.network.listen(server.port, server.onListen)

server.udpnetwork = require('dgram').createSocket('udp4')
server.udpnetwork.on('message', server.onUDPMessage)
server.udpnetwork.on('listening', server.onUDPListen)
if (server.UDP !== false)
    server.udpnetwork.bind({ address: "localhost", port: server.port})