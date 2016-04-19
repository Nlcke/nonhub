function love.load()
	nonhub = require "nonhub"
	client = nonhub.new {}
	client.connect()
end

function love.update(dt)
  client.receive()
end