nonhub = require "nonhub"
hub = nonhub.new {debug = false, requiredModes = {"eval"}}
client.onConnect = function()
  print(("connected to %s:%s"):format(client.address, client.port))
end
client.onDisconnect = function(src, err)
  print(("disconnected from %s:%s"):format(client.address, client.port))
  if err then print("error while "..src..": "..err) end
end
print [[
[available commands]
:connect
:connect address
:connect address port
:disconnect
]]
client.connect()

local function inputRequest()
  io.write(client.address..":"..client.port..(client.isConnected and "> " or "! "))
  io.flush()
  local input = io.read()
  if input:find ":connect" == 1 then
    client.disconnect()
    local args = {}
    for arg in input:gmatch "%s%S+" do table.insert(args, arg:match "%S+") end
    client.address, client.port = args[1] or client.address, tonumber(args[2]) or client.port
    client.connect()
  elseif input:find ":disconnect" == 1 then
    client.disconnect()
  else
    client.send.eval = input
    return
  end
  inputRequest()
end

local incomplete = true

client.on.eval = function(msg) print(msg); incomplete = true end

local frameTime = 0.016
local timeout = 3

local frameTimeout = math.ceil(timeout / frameTime)

local frameCounter = 0
local time = socket.gettime()
while true do
  local newtime = socket.gettime()
  if newtime - time >= frameTime then
    client.receive()
    if incomplete or not client.isConnected then
      inputRequest()
      incomplete = false
    else
      frameCounter = frameCounter + 1
      if frameCounter >= frameTimeout then
        print "[timeout]"
        incomplete = true
        frameCounter = 0
      end
    end
    time = newtime
  end
end