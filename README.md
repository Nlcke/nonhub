# Nonhub
Nonhub is a free opensource multiplayer framework for Lua clients. Nonhub made-up of two parts: one is Node.js server and other is Lua client. Server works on any computer with Node.js and supports Heroku platform while client runs on any Lua implementation with LuaSocket library. There are examples for pure Lua and all popular Lua engines: Gideros, Corona, MOAI, LÖVE, Defold.

## Features:
* Easy to use
* High performance
* Fully customizable via modes
* Optional UDP for fast paced games
* Developer-friendly
* On-the-fly server patching
* Heroku PaaS support

## Table of Contents
* [Local installation](#local-installation)
* [First run](#first-run)
* [Deployment to Heroku](#deployment-to-heroku)
* [First custom mode](#first-custom-mode)
* [Nonhub folder structure](#nonhub-folder-structure)
* [Lua project](#lua-project)
* [Node.js project](#nodejs-project)
* [Modes](#modes)
* [Acknowledgments](#acknowledgments)
* [MIT License](#mit-license)

## <a name="local-installation">Local installation</a>
You must have installed copy of [Node.js](https://nodejs.org/) in order to run Nonhub server and to install NPM modules.

Nonhub can be installed as a module via [NPM](https://www.npmjs.com/) `npm install nonhub` or downloaded from [GitHub](https://github.com/nlcke/nonhub) and used directly.

### Difference
The module will be installed to `./node_modules/nonhub` in the current project folder. You need to create a launch file with `.js` extension (e.g. `app.js`) and write the line of code to it: `require('nonhub')`. The launch file can be used to start the server (e.g. `nodejs app.js`).

If you downloaded Nonhub from GitHub you can also use it as a module: just put `nonhub` folder to `node_modules` in your project folder. Or you can use `nonhub` folder as a project folder and `nonhub.js` as a launch file for the server: `nodejs nonhub.js`.

Module installation results in cleaner project structure and seems more natural for Node.js.

### Notes
* All configuration files will be created and updated in the current project folder.
* Modes will be loaded from both `./modes` and `./node_modules/nonhub/modes` folders (adjustable in `settings.json/modePaths`).
* Node modules required for some modes must be installed manually.

### Additional tools
To simplify Lua development I recommend [ZeroBrane Studio](https://studio.zerobrane.com/).

To write and debug Nonhub modes you can use [Visual Studio Code](https://code.visualstudio.com/).

## <a name="first-run">First run (ping-pong time!)</a>
1) Start the server locally from Nonhub folder via CLI `nodejs nonhub.js` or run it from your JavaScript IDE. Server will show debug messages and generate `settings.json`, `cfg.lua` and `modes.json` files in the Nonhub folder.
2) Copy a `ping-pong` example for your Lua implementation from Nonhub `examples` folder to your Lua projects folder.
3) Copy `nonhub.lua` and `cfg.lua` files from Nonhub folder to the root of your project.
4) Run `main.lua` via your Lua IDE or via CLI `lua main.lua` if you are using pure Lua. You will see configuration info and connection info at start and every 5 seconds `[ping]` and `[pong]` messages will popup. On the server you will see debug info when client connects and disconnects.

Congratulations, your server is working! Isn't that awesome? :sunglasses:

## <a name="deployment-to-heroku">Deployment to Heroku</a>
You can run Nonhub server on the Heroku platform for free but beware about main limitation of the free plan: all apps must sleep (i.e. they will be disabled) 6 hours in a 24 hour period. Also Heroku conceptually has no persistent file storage and you need to use an addon like Heroku Postgres for this. And no UDP thus you need to set `settings.json/UDP` key to __false__. So let's start.

1) Register [Heroku account](https://signup.heroku.com/signup/dc).
2) Intall [Heroku Toolbelt](https://toolbelt.heroku.com/).
3) Create file named __Procfile__ in your server project folder and add this line to it:
```
web: node your_launch_file.js
```
where `your_launch_file` must be replaced with the name of your launch file, for example `nonhub.js` if you are working from Nonhub directory.
4) Use CLI from your server project folder:
```
git init
echo "node_modules" > .gitignore
git add .
git commit -m "your_commit_description_here"
heroku apps:create your_app_name
git push heroku master
```
5) In Lua project set `address` to your Heroku project address (it's shown after `heroku apps:create` command) and `port` to __80__. For example:
```lua
client = nonhub.new {
    address = "nonhubserver.herokuapp.com",
    port = 80
}
```
Run your Lua client and if `debug` is enabled you will see the server handshake, something like this:
```
HTTP/1.1 101 Switching Protocols
Connection: Upgrade
Upgrade: WebSocket
Via: 1.1 vegur
```
Your Heroku server is working and that's great!

Later, if you need to update your server you can use the following CLI commands from the server project folder:
```
git add .
git commit -m "your_commit_description_here"
git push heroku master
```
## <a name = "first-custom-mode">First custom mode</a>
Functionality of the Nonhub can be extended through the modes. You will need basic knowledge of [JavaScript](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference) and [Node.js libraries](https://nodejs.org/dist/latest-v5.x/docs/api/). The most important Node.js library for Nonhub is [Buffer](https://nodejs.org/dist/latest-v5.x/docs/api/buffer.html) used for message processing. It allows to keep Nonhub performance at high level. Also don't forget about tons of ready [NPM modules](https://www.npmjs.com/). You can easily use them in your modes, just require them in `server` section and add their names to `nodemodules` section of your mode. Well, let's start from the scratch.
1) Create empty file in Nonhub `modes` folder and name it `testmode.js`. The file must have `.js` extension while it's basename can be arbitrary.
2) Run the server. You will see warnings about mode creation:
```
mode 'testmode' created from mode template
modes.json: new modes added and enabled:
• testmode
```
Modes created from the template already work although as it is they can be used only for simple tests. That's because their `handler` key is empty function and `level` key is at 0 so server just sends any received message back to the client without any processing. Also such modes have same names as their files and version 1.0.0 by default.
3) Restart the server to load it with the mode.
4) Copy updated `cfg.lua` to Lua project folder. (You can set the path to your Lua project and change the name of `cfg.lua` file in the `clientCfgPath` key of `server` section in `cfg.json` file. If you do it will be automatically updated each time you start the server and no copying will be needed.)
5) In Lua project add `client.send.testmode = "test"` line to the game loop, and run it. You will see how client sends and receives it's own "test" message at the speed of your game loop (usually 60 fps). This means your first mode is working but it's useless. 
6) To make it more handy set `testmode.js/unpacker` key to `'function(data, client) return tonumber(data) end'` function. Now your mode can send and receive any valid number and we can use it to measure server response time!
7) Replace `client.send.testmode = "test"` with `client.send.testmode = socket.gettime()` and add `client.on.testmode = function(msg) print(socket.gettime() - msg) end` callback before the game loop. Disable debug info for a while: add `debug = false` to the options table of `nonhub.new`. Run your Lua project and check latency of your server. Great! You easily created simple but useful mode. Of course most modes are more complex although they all have the same base. Check __Modes__ section for more info.
## <a name = "nonhub-folder-structure">Nonhub folder structure</a>
* __examples:__ — _Lua app examples_
  * __engine1__: — _each engine has it's own examples_
    * __example1__ — _copy nonhub.lua and cfg.lua to an example folder before the run_
    * __...__
  * __...__
* __modes:__ — _this plugins can be enabled in modes.json and adjusted in settings.json_
  * mode1.js
  * mode2.js
  * ...
* __cfg.lua__ — _required for Lua client, generated and updated at server start_
* __core.js__ — _main part of Node.js server, can be tuned via settings.json_
* __modes.json__ — _list of modes to enable/disable, generated and updated at server start_
* __nonhub.js__ — _server loader: checks modes, updates configs, starts the server_
* __nonhub.lua__ — _client library, depends on cfg.lua_
* __settings.json__ — _required for Node.js server, generated and updated at server start_

## <a name = "lua-project">Lua project</a>
### Intro
Require Nonhub module:
```lua
nonhub = require "nonhub"
```
Create new client and overwrite options of `cfg.lua` if needed: 
```lua
client = nonhub.new(options)
```
Add callbacks to the client:
* onConnect     = function(clientHS, serverHS) ... end
* onDisconnect  = function(src, err) ... end
* on[mode]      = function(msg, id) ... end
* onError[mode] = function(err, num) ... end

Use networking methods of the client:
* connect()
* disconnect()
* send[mode] = msg
* receive()

### nonhub.new(options)
After you required `nonhub.lua` module you need to create a client (or multiple clients for local testing). This function accepts only one argument called _options_ which must be a table. Nonhub loads client configuration from `cfg.lua` first and then updates it from this options table. Therefore you can use the options to redefine any key from `cfg.lua`. For example:
```lua
client = nonhub.new {
	debug = false,
    interval = 3
}
```
### Callbacks
Nonhub client also works as event emitter so you need callbacks to react to that events.
#### onConnect(clientHS, serverHS)
Called right after _successful_ connection to the server. Then client will start receiving and will be able to send messages. Handshakes (__clientHS__ and __serverHS__) can be used mainly for debugging. For example:
```lua
client.onConnect = switchToMultiplayerScreen -- absctract game function
```
#### onDisconnect(src, err)
Called after normal disconnect via client `disconnect` method or on a failure.

Parameter __src__ represents the source (place) of an error. Can be __nil__ in case of normal disconnect or one of the following strings:
* create socket
* connect
* send handshake
* receive handshake
* send message
* receive message

Parameter __err__ describes the error. Can be __nil__ in case of normal disconnect, luasocket error (e.g. "closed", "timeout", "host not found") if connection aborted or special "version mismatch" error. Last one indicates that client app must be updated. 

Parameters __src__ and __err__ can be used in if-branching to cover all possible failures. For example:
```lua
client.onDisconnect = function(src, err)
	if err == "version mismatch" then print "Update your app"
    elseif src == "connect" then print "Cannot connect to server"
    elseif err then print "Server is busy" end
    switchToMainScreenScene() -- absctract game function
end
```
#### on[mode](msg, id)
If client's request was processed without errors the message __msg__ will be sent to that client (in this case __id__ is nil) or broadcasted to the group (__id__ is integer number). This is the most important callback to control your multiplayer app. It's like keyboard, mouse or touchscreen input for singleplayer. For example:
```lua
client.on.login = switchToPublicRoom 
client.on.position = function(msg, id)
    if not players[id] then players[id] = Player.new() end
    players[id]:setPosition(msg.x, msg.y)
end
```
#### onError[mode](err, num)
If client's request cannot be processed normally server sends back error message. You can find out the kind of error either by it's description (__err__) or by it's number. If-branching can be used to handle each error differently. For example:
```lua
client.onError.login = function(err, num)
    showWarning(err)
    if err == "wrong password" then addRestorePasswordButton() end
    if err == "multiple login" then switchToCreateAccountScene() end
end
```
### Networking
Functions to do main network operations.
#### connect()
Tries to connect the client to the server and calls `onConnect` on success or `onDisconnect` on error. After successful connection client will be able to send and receive messages. When client disconnected `send` and `receive` functions do nothing. For example:
```lua
client.connect()
```
#### disconnect()
Disconnects the client from the server. When client disconnected `send` and `receive` functions do nothing. For example:
```lua
client.disconnect()
```
#### send[mode] = msg
Each time you assign a __msg__ value to a __mode__ key  ___newindex_ metamethod of the `send` table is called. Your message will be encoded with packer function of this __mode__ and sent to the server. If packed message is bigger than `maxMessageLength` the message will not be sent at all. In such a case you need to adjust that key in `settings.json`. If server is overloaded by requests not all messages could be sent on the first try. Then the client caches the request and tries to resend it before `retries` counter becomes bigger than `maxRetries` value or the client will disconnect itself from the server. For example:
```lua
client.send.position = {players[client.id].x, players[client.id].y}
```
#### receive()
This function must be put in the game loop to give __luasocket__'s `receive` method some time and Nonhub does this automatically for some Lua engines. (You can change this behaviour via `autoReceive` key.) When normal message received it will decoded by the appropriate `unpacker` and passed to `on` callback for the message mode. When error message received it will be passed to `onError` callback for the message mode. For example:
```lua
timer:addEventListener(Event.TIMER, client.receive)
```
### Options
Each Nonhub client created with options from `cfg.lua` file by default. Nonhub server generates and updates this file automatically from available modes and server settings at each server start. You can set `settings.json/clientCfgPath` to your project path for direct updates. It's rare case when you want create or update this file manually because every key from this file can be redefined in Nonhub `new` method's options. Without modes `cfg.lua` looks like this:
```lua
return {

address = "localhost",
autoReceive = true,
clientHandshake = "GET /%s HTTP/1.1\r\nHost: %s\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n",
debug = true,
interval = 5,
luamodules = {},
maxMessageLength = 65535,
maxModeIndex = 5,
maxRetries = 5,
maxUDPPackets = 60,
modeErrors = {},
modeIndexes = {},
modeLevels = {},
modeNames = {},
modePackers = {},
modeUnpackers = {},
on = {},
onConnect = function(clientHS, serverHS) end,
onDisconnect = function(src, err) end,
onError = {},
port = 80,
requiredModes = {},
timeout = 5,
version = "1.0.0",

}
```
#### address
Address of the Nonhub server. Can be an IP address or a host name.
#### autoReceive
Some Lua engines support game loop events like '__onEnterFrame__'. If this key set to true Nonhub tries to add Nonhub `receive` method as a callback to such event. If not you must add it manually to the game loop. 
#### clientHandshake
This string must contain two "%s" placeholders: one for server `address` and other for client `version`. While connection client sends this string to the server.
#### debug
Very detailed info about Nonhub client work. Can be enabled/disabled with `true`/`false` values.
#### interval
Keep alive interval in seconds. Some platforms can automatically disconnect a client if it's not active (i.e. no message received from the client) for specific period of time. To prevent this Nonhub client after inactivity interval sends a `ping` message to the server and waits `pong` message from it.
#### luamodules
For simplicity each Lua module listed here will be automatically required globally to be available for some modes. If Nonhub client doesn't detect these modules at start you will get an error message.
#### maxMessageLength
This key must always have same value as `settings.json/maxMessageLength` key. It defines buffer size for each client on the server i.e. acceptable length of a message after processing with `packer` function on the client side. Server will silently disconnect clients attempting to send a message exceeding this length. That's why each client always compares resulting message length with this key value to report about the error via `onDisconnect("send message", "oversized message")` call.
#### maxModeIndex
When received message mode index is higher than this value received message will be treated as error message.
#### maxRetries
When `settings.json/maxConnections` is too high and server overloaded by requests a client cannot always send a message. In this case client caches last unsent message and automatically tries to send it again increasing `retries` counter after each failure. When `retries` exceeds `maxRetries` the client disconnects with __timeout__ error.
#### maxUDPPackets
This key defines the number of UDP packets your client will be able to receive per each `client.receive()` call. Since each client sends same number of packets per second you can set this key to the maximum size of the 'game room' i.e. maximum number of players in the broadcasting group. This must be an integer number higher than 0 (otherwise UDP receiving will be disabled). 
#### modeErrors
Table with error descriptions for each mode. They will be passed to `onError` callbacks as first argument. 
#### modeIndexes
Table to convert mode names to mode indexes.
#### modeLevels
Table with `level` for each mode.
#### modeNames
Table to convert mode indexes to mode names. 
#### modePackers
Table of `packer` functions for each mode.
#### modeUnpackers
Table of `unpacker` functions for each mode.
#### on
This is the table of mode callbacks with `(msg, id)` for normal messages.
#### onConnect
This is callback with `(clientHS, serverHS)` for connect event.
#### onDisconnect
This is callback with `(src, err)` for disconnect event.
#### onError
This is the table of mode callbacks with `(err, num)` for error messages.
#### port
External port of the Nonhub server. Must be an integer number in the range 1..64K.
#### requiredModes
This can be used for an extra check on the client side (very useful for examples). If `cfg.lua` doesn't contain some modes from this list Nonhub client will give you error message with unfound modes listed.
#### timeout
This key defines a limit on the amount of time for establishing a connection to the server, in seconds. Do not set this value too low or client will not be able to connect to some servers and `onDisconnect` event will happen. Also do not set this value too high because `connect` is a blocking operation.
#### version
When client connects to the server it sends a handshake with the `version` value. Then server compares received version with the version from `settings.json` and if it doesn't match disconnects the client. In this case client's `onDisconnect` callback will be called with `("connect", "version mismatch")` arguments. This serves as a simple protection from unwelcome connections to the server and can be used to warn clients about server update so clients must be updated too in order to use the server.

## <a name = "nodejs-project">Node.js project</a>
Server loads all modes and configurations automatically. It has two configuration files in the form of `modes.json` and `settings.json`, server loader `nonhub.js` and server core `core.js`. If you are using Nonhub as a Node.js module you need to create a file with `.js` extension and add this line to it:
```javascript
require("nonhub")
```
### How nonhub.js works
1) It tries to load `core.js`, `settings.json` and `modes.json`.
2) It loads all available modes from paths in `settings.json/modePaths`. Modes must have no syntax errors or loader will crash while `require` them.
3) It updates `modes.json`. All newly added modes are added to it and enabled while unfound ones will be removed from this file. All disabled modes will not be used for server work.
4) It checks all modes for error of different kinds. If any error occurs it will show error description and throw an error message.
5) It creates __server__ object (shared state between all clients) and updates `settings.json` and `cfg.lua`. If some function keys cannot be processed it will throw an error message. If `cfg.lua` file cannot be written it will show a warning. If the number of enabled modes is over 255 it will throw an error message.
6) It creates connection listener and port listener to process clients' messages.
### settings.json
Configuration file for the server. Modes can add their own settings here. Without modes the file looks like this:
```json
{
    "clientCfgPath": "./cfg.lua",
    "debug": true,
    "internalPort": 80,
    "maxConnections": 10000,
    "maxMessageLength": 65535,
    "modePaths": [
        "./node_modules/nonhub/modes/",
        "./modes/"
    ],
    "serverHandshake": "HTTP/1.1 101 Switching Protocols\r\nConnection: Upgrade\r\n\r\n",
    "UDP": null,
    "version": "1.0.0"
}
```
#### clientCfgPath
Each Nonhub client loads it's settings from `cfg.lua` configuration file by default. You can set `clientCfgPath` to that file right inside your project to overwrite it automatically when you change your server configuration and modes. For example:
```json
"clientCfgPath": "D:/Projects/LuaMultiplayer/cfg.lua"
```
#### debug
Shows some debug info when server starts or a client connects/disconnects.
#### internalPort
When your server is not on the Heroku platform this port will be used. 
#### maxConnections
If server fully loaded by client requests some clients will not be able to send their messages straightway i.e. they will look laggy for other clients. To prevent such behaviour you can use this key. When number of clients is equal to this key new clients will be disconnected from the server.
#### maxMessageLength
This parameter defines max size of each message received by the server. When client sends a message bigger than this limit it will be silently disconnected. For each client the server creates a buffer of this size so this can be used to lower server memory consumption. The value must be an integer in range 0..65535.
#### modePaths
When server starts it tries to load modes from this paths in the array order. You can use as many paths as you want but beware: if some modes have same name only last one will be used. 
#### serverHandshake
This can be used when trying a PaaS other than Heroku. Some platforms work only with certain Websocket libs and thus cannot be used for Nonhub e.g. OpenShift Online. 
#### UDP
Can have one of the following values:
* null — server will use UDP for modes with level 3 and TCP for modes with level 2
* true — server will use UDP for all modes with level 2 and 3
* false — server will use TCP for all modes and it will not bind UDP socket
#### version
This key used to control server and client updates. When you update your Nonhub server you need to adjust this key so client will see that it needs an update too (client has it's own `cfg.lua/version` key). Can be any string allowed for HTML requests. For example:
```json
"version": "multiplayer-v.1.2.3-beta"
```
### modes.json
Modes are plugins for Nonhub. Each message encoded with first byte as a mode index so total modes number cannot exceed 255 (`0b11111111` value used for an error) or you will get an error message. At start Nonhub server checks `modes` folder and updates `modes.json` file where modes can be enabled or disabled. The file looks like this:
```json
{
    "mode1": true,
    "mode2": false,
    "...": "...",
    "modeN": true
}
```

Each mode can be enabled or disabled here by setting it's key to __true__ or __false__. All newly added modes are enabled by default.

Warning: even disabled modes are required by Nonhub loader at start so any mode in `modes` folder must not contain syntax errors.
## <a name = "modes">Modes</a>
Each mode has the following structure and values must have the same type as here:
```js
module.exports = {

name: "",
author: "",
version: "",
description: ``,
nodemodules: [],
nonhubmodes: [],
luamodules: [],
packer: `''`,
unpacker: `''`,
client: {},
server: {},
luacfg: {},
handler: function(client, server) {},
finalizer: function(client, server) {},
errors: {},
level: 0,

}
```
### name
A mode can be placed in a file with arbitrary filename without any influence on mode behavior. Only the name from this key matters:
* You use this name in mode callbacks and __send__ function. If you are mode developer you can try to use names which are Lua identifiers because of short dot-syntax. For example name '__to all friends__' can be used only as __client.send["to all friends"] = "Hello"__ while name '__to_all_friends__' can be alternatively used as __client.send.to_all_friends = "Hello"__.
* Server uses this name when checks modes dependencies from `nonhubmodes`.
* File `modes.json` contains this mode names as keys to enable/disable them.

### author
Doesn't affect mode behaviour. Just some information about mode creator which can be useful for a search.
### version
Doesn't affect mode behaviour. Useful for mode developers.
### description
Doesn't affect mode behaviour. Important key for users of the mode.
### nodemodules
A mode can depend on some node modules. Their names can be listed in this array as strings.
### nonhubmodes
A mode can depend on other modes. Their names can be listed in this array as strings.
### luamodules
`packer` and `unpacker` functions can depend on some Lua modules. Their names can be listed in this array as strings.
### packer
Lua function on client side with two parameters __(message, client)__ which converts specific Lua value (i.e. table) to Lua string before sending over TCP. This function is the first one in the '_packer -> handler -> unpacker_' processing chain. The key accepts Lua function like '__function(msg, client) if type(msg) == "table" then return json.encode(msg) else return tostring(msg) end__'. Value of this key must be inside additional quotes in order to be recognized as a Lua code and to be saved in `cfg.lua` correctly.
### unpacker
Lua function on client side with two parameters __(data, client)__ which converts Lua string to specific Lua value (e.g. table) after receiving over TCP from the server. This function is the last one in the '_packer -> handler -> unpacker_' processing chain. The key accepts Lua function like '__function(data, client) local ok, msg = pcall(json.decode, data); if ok then return msg else return data end__'. Value of this key must be inside additional quotes in order to be recognized as a Lua code and to be saved in `cfg.lua` correctly.
### client
Non-function keys from this object will be added to client template __server.client__. Function keys will be added to builder __server.clientBuilder__. After successful hanshake __client__ object will be created from the template, initialized by the builder and attached to __server.clients__ with unique address and port.
### server
All non-function keys from this object will be added to `settings.json` and can be redefined there. All function keys from this section will be processed before `luacfg` ones. Then all this keys will be added to global __server__ object.
### luacfg
All keys from this object will be processed and added to `cfg.lua` file required by client library. This object always processed after __server__ object. Function keys processed after non-function ones.
### handler
JavaScript function on server side with two parameters (_client_, _server_) which handles received data processing and can define group of recipients for processed data. This function is the middle one in the '_packer -> handler -> unpacker_' processing chain.

To process received data without performance degradation `handler` works with [Node.js buffer](https://nodejs.org/api/buffer.html). Normally this function returns nothing because it modifies buffer (__client.buf__), buffer length (__client.bufLen__), __server__ object  and/or __client__ object and server sends content of the modified buffer sliced at __client.bufLen__ to the client(s). For example:
```js
handler: function(client, server) {
    client.username = client.buf.toString("utf8", 3, client.bufLen)
    if (client.id) return undefined
    client.id = server.idsReserved.pop() || ++server.idsCounter
    server.ids[client.id] = client
}
```
Nonhub uses first 3 bytes (0, 1, 2 for Node.js buffer) to store mode index and message length therefore nonempty message must be processed from 4th byte (3 for Node.js buffer). 

If something goes wrong it must return error number (these can be later described in `errors`) This must be an integer in range __0..254__. Number __255__ means "no id"-error which handled by server automatically. When `handler` returns error server sends back to the client error message containing the mode and error number. For example:
```js
handler: function(client, server) {
    var usernameLength = client.buf[3]
    if (usernameLength > 16) return 0
}
```
When `level` of the mode is at __2__ (_broadcast_) `handler` must also define __client.group__ If not defined group of receivers will be empty and server will send nothing. For example:
```js
handler: function(client, server) {
    client.group = server.clients
}
```
### finalizer
JavaScript function on server side with two parameters (_client_, _server_) which triggers on client disconnect. Can be used to clean up __server__ object or to write some info about client into database. For example:
```js
finalizer: function(client, server) {
    if (client.id) {
        server.idsReserved.push(client.id)
        delete server.ids[client.id]
    }
}
```
If finalizer is not needed then it must be set to empty function without parameters i.e. __function() {}__ to save some resources.
### errors
If `handler` returns error codes then here they can be described in the form of strings so users of the mode will know what exactly happen. Also useful for mode developers themselves. For example:
```js
errors: {
    0: "database error"
    1: "request too long"
    2: "user not found"
}
```
### level
Restricts access to the mode. Currently 4 levels supported:
* __0__ (_unauthorized singlecast_) — any client can use this mode even ones without assigned __id__ (i.e. id == 0) and result will be sent back to the client. 
* __1__ (_authorized singlecast_) — only clients with assigned __id__ (i.e. id > 0) can use this mode and result will be sent back to the client.
* __2__ (_reliable broadcast_) — only clients with assigned __id__ (i.e. id > 0) can use this mode and result will be sent as a TCP packet to all clients from the __client.group__ defined in `handler`.
* __3__ (_unreliable broadcast_) — only clients with assigned __id__ (i.e. id > 0) can use this mode and result will be sent as a UDP packet to all clients from the __client.group__ defined in `handler`.


## <a name = "acknowledgments">_Acknowledgments_</a>
I would like to offer my special thanks to my best friend, Kostya Krivulya aka Bones, for supporting me all this time and for his valuable advices.

I would also like to thank all [Gideros maintainers](http://giderosmobile.com/maintainers) for Gideros Studio and Gideros Engine what I used for writing and testing Nonhub client library.

## <a name = "mit-license">MIT License</a>
Copyright (c) 2016 Nikolay Yevstakhov

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
