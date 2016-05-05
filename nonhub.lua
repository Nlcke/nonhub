-- Nonhub client v1.0.0
-- Author: Nikolay Yevstakhov aka N1cke
-- License: MIT

if not pcall(require, "socket") then pcall(require, "socket.core") end

local nonhub = {}

nonhub.defaults = { -- must be in 'cfg' or 'new' ('new' rewrites 'cfg')
	debug            = "boolean"  , -- prints debug output if true
	version          = "string"   , -- must be equal to server version
	autoReceive      = "boolean"  , -- adds receive to game loop if enabled
	address          = "string"   , -- IP or host
	port             = "number"   , -- 0 — 65535
	timeout          = "number"   , -- for handshakes
	interval         = "number"   , -- to keep alive via ping-pong
	clientHandshake  = "string"   , -- string with two "%s" placeholders
	luamodules       = "table"    , -- {index = modulename, ...}
	requiredModes    = "table"    , -- {name, ...}
	maxMessageLength = "number"   , -- 0 — 65535
	maxModeIndex     = "number"   , -- 0 — 254; 255 is for errors
	maxRetries       = "number"   , -- attempts to resend a message
	maxUDPPackets    = "number"   , -- max number of players in a game room
	modeLevels       = "table"    , -- {index = level, ...}
	modeNames        = "table"    , -- {index = name, ...}
	modeIndexes      = "table"    , -- {name = index, ...}
	modePackers      = "table"    , -- {name = packer, ...}
	modeUnpackers    = "table"    , -- {name = unpacker, ...}
	modeErrors       = "table"    , -- {name = {number = error}, ...}
	onConnect        = "function" , -- callback with (clientHS, serverHS)
	onDisconnect     = "function" , -- callback with (src, err)
	on               = "table"    , -- callbacks with (msg, id) for modes
	onError          = "table"    , -- callbacks with (err, num) for modes
}

nonhub.API = [[
	client = nonhub.new(options)
	
	client.connect()
	client.disconnect()
	client.send[mode] = msg
	client.receive()
]]

nonhub.internals = [[
	client.isConnected
	client.lastMessageTime
	client.socket
	client.buffer
	client.retries
	client.cache
	client.udpsocket
]]

nonhub.onDisconnectSources = [[
	create socket
	connect
	send handshake
	receive handshake
	send message
	receive message
]]

nonhub.onDisconnectErrors = [[
	[luasocket errors]
	closed
	timeout
	host not found
	...
	[special errors]
	version mismatch
]]

function nonhub.new(options)
	local self = {}
	
	if type(options) ~= "table" then error("'new' accepts a table", 2) end
	local cfg = type(options.cfg) == "table" and options.cfg
	if not cfg then cfg = require "cfg" end
	if type(cfg) ~= "table" then error("'cfg' is not a table", 2) end
	for k,v in pairs(cfg) do self[k] = v end
	for k,v in pairs(options) do self[k] = v end
	
	local errors = false
	local l = 0; for k in pairs(self) do l = math.max(#k, l) end
	for k,t in pairs(nonhub.defaults) do
		local v = type(self[k]) == "string" and '"'..self[k]..'"'
			or tostring(self[k])
		if type(self[k]) ~= t then
			print(("[err] %-"..l.."s :: %-8s = %s"):format(k, t, v))
			errors = true
		elseif self.debug and self[k] == options[k] then
			print(("[new] %-"..l.."s = %s"):format(k, v))
		elseif self.debug then
			print(("[cfg] %-"..l.."s = %s"):format(k, v))
		end
	end
	if errors then error("incorrect types of 'new' options or 'cfg'", 2) end
	
	local missing = {}
	for _,luamodule in pairs(self.luamodules) do
		if not _G[luamodule] then
			local ok = nil
			ok, _G[luamodule] = pcall(require, luamodule)
			if not ok then table.insert(missing, luamodule) end
		end
	end
	if #missing > 0 then
		error("Missing Lua modules:\n• "..table.concat(missing, "\n• "), 2)
	end	
	
	local missing = {}
	for _,mode in pairs(self.requiredModes) do
		if not self.modeIndexes[mode] then table.insert(missing, mode) end
	end
	if #missing > 0 then
		error("Missing Nonhub modes:\n• "..table.concat(missing, "\n• "), 2)
	end
	
	local udp = false
	for i = 0, #self.modeLevels do
		if self.modeLevels[i] == 3 then udp = true; break end
	end
	if not udp then self.maxUDPPackets = 0 end
	
	self.connect = function()
		if self.isConnected then return end

		local tcpsocket, err = socket.tcp()
		if err then return self.disconnect("create socket", err) end
		tcpsocket:settimeout(self.timeout)
		tcpsocket:setoption('tcp-nodelay', true)
		self.socket = tcpsocket

		local ok, err = self.socket:connect(self.address, self.port)
		if err then return self.disconnect("connect", err) end

		local clientHS = self.clientHandshake:format(
			self.version, self.address)
		if self.debug then print("\n[connect] clientHS:\n"..clientHS) end
		local bytesSent, err = self.socket:send(clientHS)
		if err then return self.disconnect("send handshake", err) end
		
		local data = {}
		repeat
			local line, err = self.socket:receive('*l')
			if err then return self.disconnect("receive handshake", err) end
			data[#data+1] = line
		until line == ''
		local serverHS = table.concat(data, "\r\n")
		
		if self.debug then print("\n[connect] serverHS:\n"..serverHS) end
		
		if self.maxUDPPackets > 0 then
			if serverHS:match "Protocol: Error"
			then return self.disconnect("connect", "version mismatch") end

			local udpsocket, err = socket.udp()
			if err then return self.disconnect("create socket", err) end

			local ok, err = udpsocket:setpeername(self.address, self.port)
			if err then return self.disconnect("connect", err) end
			
			local udpkey = serverHS:match "UDPKey: (.*)\r\n"
			udpsocket:settimeout(self.timeout)
			
			local ok, err = udpsocket:send(udpkey)
			if err then return self.disconnect("connect", err) end
			
			udpsocket:settimeout(0)
			self.udpsocket = udpsocket
		end

		self.isConnected = true
		self.buffer = ''
		self.retries = 0
		self.cache = nil
		self.socket:settimeout(0)
		self.lastMessageTime = os.time()
	
		self.onConnect(clientHS, serverHS)
	end
	
	self.disconnect = function(src, err)
		self.isConnected = false
		if self.socket then self.socket:close(); self.socket = nil end
		if self.udpsocket then self.udpsocket:close(); self.udpsocket = nil end
		if self.debug then print("[disconnect]", src, ":", err) end
		self.onDisconnect(src, err)
	end
	
	self.send = {__newindex = function(__, mode, message)
		if not self.isConnected then return end

		local encodedMode = string.char(self.modeIndexes[mode])
		local encodedMessage = self.modePackers[mode](message, self)
		local l = #encodedMessage
		
		if self.debug then
			local header = l <= self.maxMessageLength and "[send]    "
				or "[error: size] "
			print(header, mode, ":", message)
		end
		
		local encodedLength = string.char(math.floor(l / 256), l % 256)
		local data = (encodedMode .. encodedLength) .. encodedMessage
		
		if self.modeLevels[self.modeIndexes[mode]] == 3 then
			self.udpsocket:send(data)
		else
			local bytes, err, pos = self.socket:send(data)
			if err == "closed" then self.disconnect("send message", err)
			elseif err == "timeout" then self.cache = data
			else self.cache = nil; self.retries = 0 end
		end
	end}
	setmetatable(self.send, self.send)
	
	self.receive = function()
		if not self.isConnected then return end
		
		for i = 1, self.maxUDPPackets do
			local data, err = self.udpsocket:receive()
			if data then self.buffer = data .. self.buffer end
		end

		local full, err, part = self.socket:receive '*a'
		local data = full and full or part
		if not data then return self.disconnect("receive message", err) end
		self.buffer = self.buffer .. data

		if self.debug and #self.buffer > 0 then
			print("[buffer]", self.buffer:byte(1, -1))
		end
		
		while #self.buffer > 2 do -- extract messages from buffer
			local byte1, byte2, byte3 = self.buffer:byte(1, 3)
			
			if byte1 <= self.maxModeIndex then -- normal message
				local mode = self.modeNames[byte1]
				local hasID = self.modeLevels[byte1] >= 2
				local endPos = 3 + byte2 * 256 + byte3 + (hasID and 4 or 0)
				if #self.buffer < endPos then break end
				
				local b1, b2, b3, b4 = self.buffer:byte(endPos - 3, endPos)
				local id = hasID and b1*16777216+b2*65536+b3*256+b4 or nil
				local data = self.buffer:sub(4, id and endPos - 4 or endPos)
				local message = self.modeUnpackers[mode](data, self)
				self.buffer = self.buffer:sub(endPos + 1)
				if self.debug then
					print("[receive] ", mode, ":", message, "[", id, "]")
				end
				if self.on[mode] then self.on[mode](message, id) end				
			elseif byte2 <= self.maxModeIndex then -- error message
				self.buffer = self.buffer:sub(4)
				local mode = self.modeNames[byte2]
				local err, num = self.modeErrors[mode][byte3], byte3
				if self.debug then print("[error]", mode, err, num) end
				if self.onError[mode] then self.onError[mode](err, num) end
			else -- pong message
				self.buffer = self.buffer:sub(4)
				if self.debug then print "[pong]" end
			end
		end

		if data ~= '' then
			self.lastMessageTime = os.time()
		elseif os.time() - self.lastMessageTime >= self.interval then
			if self.debug then print "[ping]" end
			local bytes, err = self.socket:send "\255\255\255"
			if err then self.disconnect("send message", err) end
			self.lastMessageTime = os.time()
		end
		
		if self.cache then
			if self.debug then print("[cache]", self.cache:byte(1, -1)) end
			local bytes, err, pos = self.socket:send(self.cache)
			if err == "timeout" then self.retries = self.retries + 1 end
			if err == "closed" or self.retries > self.maxRetries then
				self.disconnect("send message", err)
			end
			if not err then self.cache = nil; self.retries = 0 end
		end
	end
	
	if not self.autoReceive then
		-- manually add hub.receive() to game loop
	elseif application and Core then -- Gideros?
		stage:addEventListener('enterFrame', self.receive)
	elseif system and Runtime then -- Corona?
		Runtime:addEventListener('enterFrame', self.receive)
	elseif MOAIAction and MOAITimer then -- MOAI?
		local timer = MOAITimer.new()
		timer:setSpan(1/60)
		timer:setMode(MOAITimer.LOOP)
		timer:setListener(MOAITimer.EVENT_TIMER_END_SPAN, self.receive)
		timer:start()
	else
		-- LÖVE? Add hub.receive() to love.update() callback and 
		-- enable console through conf.lua to see debug output
		-- Defold? Add hub.receive() to update() callback and
		-- explicitly require 'cfg'
	end
	
	return self
end

return nonhub