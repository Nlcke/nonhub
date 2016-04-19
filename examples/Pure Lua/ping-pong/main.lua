nonhub = require "nonhub"
client = nonhub.new {}
client.connect()

-- primitive game loop for pure Lua
-- receives 1 message per second
local time = os.time()
while true do
  if os.time() > time then
    client.receive()
    time = os.time()
  end
end