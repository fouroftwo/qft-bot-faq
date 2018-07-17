var self = module.exports = {
	processFaq: function (message) {
		try {
			web.channels.info(message.channel).then(info => {
				if (info.ok) {
					if (debugging) {
						console.log('This is public channel received')
						console.log('Message')
						console.log(message)
						console.log('Info')
						console.log(info)
					}
					self.prepareMessage(message.user, message, true)
				}
			}).catch(function (e) {
				if (debugging) {
					console.log('This is private channel received')
					console.log('Message')
					console.log(message)
					console.log(e)
				}
				self.prepareMessage(message.user, message, false)
			})
		}
		catch (e) {
			if (debugging) {
				console.log('Error on matching channels.info with a channel')
			}
		}
	},

	/**
	 * Pads and prepends and extends message strings before sending it to a
	 * recipient
	 * @param channel The channel the message is supposed to be sent to
	 * @param message The contents of the message as it is now
	 * @param prepend What to prepend the message with, if anything
	 */
	prepareMessage: function (channel, message, prepend) {
		let description = undefined
		let mainCommand = undefined
		let compoundCommand = undefined
		let taggedUser = undefined
		let response = ''
		let commandingUser = channel
		if (debugging) {
			console.log('Commanding user: ' + commandingUser)
		}
		message.text = message.text.split(' ').slice(0, 2)
		try {
			if (PROTECTED_COMMANDS.indexOf(message.text[0]) > -1 ||
				Object.keys(COMMANDS_ENABLED_FLAT).indexOf(message.text[0]) > -1) {
				mainCommand = message.text[0]
			}
		}
		catch (e) {
		}

		try {
			if (message.text[1].indexOf('@U') > -1) {
				taggedUser = message.text[1].substring(2, message.text[1].length - 1)
			}
			else if (TOPICS.indexOf(message.text[1]) > -1) {
				compoundCommand = TOPICS[TOPICS.indexOf(message.text[1])]
			}
		}
		catch (e) {
		}

		if (debugging) {
			console.log('messageText: [' + message.text + '] mainCommand [' + mainCommand + '] compoundCommand [' +
				compoundCommand + ']')
		}
		if (mainCommand === '!help' && compoundCommand !== undefined) {
			let compoundCommandKeys = Object.keys(COMMANDS_PUBLIC[compoundCommand])
			response += '*' + COMMANDS_PUBLIC[compoundCommand].description + '*\n'
			for (let j = 0; j < compoundCommandKeys.length; j++) {
				if (compoundCommandKeys[j] !== 'description') {
					response += compoundCommandKeys[j] + '\n'
				}
			}
		}
		else if (mainCommand === '!all') {
			for (let i = 0; i < TOPICS.length; i++) {
				if (TOPICS[i] !== undefined) {
					response += '*' + TOPICS[i] + '*\n'
					let commandsInTopic = Object.keys(COMMANDS_PUBLIC[TOPICS[i]])
					for (let j = 0; j < commandsInTopic.length; j++) {
						if (commandsInTopic[j] !== undefined && commandsInTopic[j] !== 'description') {
							response += commandsInTopic[j] + '\n'
						}
					}
				}
			}
		}
		else if (mainCommand === '!help' || mainCommand === '!hepl' || mainCommand === '!halp') {
			response += 'Below is a list of topics highlighted in bold, and also a description of each topic.\n\nType `!help [topic]` to get a list of commands for that topic.\n\n'
			for (let i = 0; i < TOPICS.length; i++) {
				if (TOPICS[i] !== undefined) {
					description = COMMANDS_PUBLIC[TOPICS[i]]['description']
					response += '*' + TOPICS[i] + '*' + ': ' + description + '\n'
				}
			}
			response += '\n\nType `!all` to see all available commands in all topics.'
		}
		else if (mainCommand !== undefined) {
			if (debugging) {
				console.log('Finding message for command in list')
			}
			response += COMMANDS_ENABLED_FLAT[mainCommand]
		}
		else {
			response += 'BLEEP, BLOOP. I didn\'t understand that command.\n\n' + HELP_RESPONSE
		}

		if (taggedUser !== undefined) {
			if (superUsers.indexOf(commandingUser) > -1) {
				if (debugging) {
					console.log('This user is a madmin, passing message along...')
				}
				stats(commandingUser + ";" + taggedUser + ";" + mainCommand + ";" + compoundCommand);
				module.exports.sendDM(taggedUser, response)
			}
			else {
				if (debugging) {
					console.log('This user isn\'t a madmin, Duin\' nuth\'n\'!')
				}
			}
		}
		else {
			if (prepend) {
				response = HELP_PUBLIC_CHAT_RESPONSE + response
			}
			stats(commandingUser + ";" + taggedUser + ";" + mainCommand + ";" + compoundCommand);
			module.exports.sendDM(channel, response)
		}
	},

	/**
	 * Sends a message to a recipient
	 * @param channel The receiving channel; a user ID as a string
	 * @param message The complete message as a string
	 */
	sendDM: function (channel, message) {
		// TODO Fuck: https://github.com/slackapi/node-slack-sdk/issues/69
		// https://github.com/slackapi/node-slack-sdk/issues/148
		web.im.open(channel, function (err, resp) {
			if (debugging) {
				console.log('sendDM()')
				console.log(err)
				console.log(resp)
			}
			// Check `err` for any errors.
			// `resp` is the parsed response from the api.
			// Check API docs for what `resp` can be.
			// console.log(resp);
			rtm.sendMessage(message, resp.channel.id)
		})
	},
}