require('./console-file')
require('./stats-file')
const fs = require('fs')
const CONFIGURATION = require('./configuration-local.json')
const scriptPath = CONFIGURATION['script-path'] || './'
const bot_token = process.env.SLACK_BOT_TOKEN || CONFIGURATION['bot-token'] || ''
const botChannel = CONFIGURATION['bot-channel'] || 'G854US8MR'
const reportChannel = CONFIGURATION['report-channel'] || 'G854US8MR'
const faqHandler = require(scriptPath + 'faq-handler.js')
const coinStatusHandler = require(scriptPath + 'coinstatus-handler.js')
process.on('SIGUSR1', function () {
	coinStatusHandler.sendCoinScraperReport(reportChannel, coinStatusHandler.CONTINUOUS_REPORT)
	return
})

RtmClient = require('@slack/client').RtmClient
RTM_EVENTS = require('@slack/client').RTM_EVENTS
rtm = new RtmClient(bot_token)
CLIENT_EVENTS = require('@slack/client').CLIENT_EVENTS
WebClient = require('@slack/client').WebClient
web = new WebClient(bot_token)

start()
triggerWords = JSON.parse(fs.readFileSync(scriptPath + 'trigger-words.json', 'utf8'))
debugging = process.env.DEBUGGING || CONFIGURATION['debugging'] || false
superUsers = process.env.SUPER_USERS || CONFIGURATION['super-users']

TOPICS = Object.keys(triggerWords.public_commands)
PROTECTED_COMMANDS = Object.keys(triggerWords.magic_commands)
COMMANDS_PUBLIC = JSON.parse(JSON.stringify(triggerWords.public_commands))
COMMANDS_ENABLED_FLAT = {}
for (let i = 0; i < TOPICS.length; i++) {
	if (triggerWords.public_commands[TOPICS[i]].enabled) {
		if (debugging) {
			console.log('Enabled: ' + TOPICS[i])
		}
		COMMANDS_ENABLED_FLAT = Object.assign(COMMANDS_ENABLED_FLAT, triggerWords.public_commands[TOPICS[i]])
		delete COMMANDS_ENABLED_FLAT['enabled']
		delete COMMANDS_ENABLED_FLAT['description']
		delete COMMANDS_PUBLIC[TOPICS[i]]['enabled']
	}
	else {
		if (debugging) {
			console.log('Disabled: ' + TOPICS[i])
		}
		delete COMMANDS_PUBLIC[TOPICS[i]]
		delete TOPICS[i]
	}
}
HELP_RESPONSE = 'Please type `!help` in a private chat to me, to show all available help topics.'
HELP_PUBLIC_CHAT_RESPONSE = 'Kindly send me commands as direct messages (by talking to me directly). This keeps the channels nice and clean.\n\n'

EXCHANGES = JSON.parse(JSON.stringify(triggerWords.exchanges))
coinsStatuses = {}
marketStatuses = {}
url = 'http://www.bittrex.com/status'

Array.prototype.diff = function (arr2) {
	let ret = []
	for (let i in this) {
		if (arr2.indexOf(this[i]) > -1) {
			ret.push(this[i])
		}
	}
	return ret
}

function start () {
// The client will emit an RTM.AUTHENTICATED event on successful connection, with the `rtm.start` payload
	rtm.on(CLIENT_EVENTS.RTM.AUTHENTICATED, (rtmStartData) => {
		for (const c of rtmStartData.channels) {
			if (c.is_member && (c.name === 'botchat' || c.name === 'test_lab')) {
				if (debugging) {
					console.log('Found ' + c.name)
				}
				//botChannel = c.id;
			}
		}
		console.log(
			`Logged in as ${rtmStartData.self.name} of team ${rtmStartData.team.name} in channel ${botChannel}`)
	})

// you need to wait for the client to fully connect before you can send messages
	rtm.on(CLIENT_EVENTS.RTM.RTM_CONNECTION_OPENED, function () {
		rtm.sendMessage('Bot is online!', botChannel)
	})

	rtm.on(RTM_EVENTS.MESSAGE, function handleRtmMessage (message) {
		if ((message.subtype && message.subtype === 'bot_message') ||
			(!message.subtype && message.user === rtm.activeUserId) || message.user === undefined) {
			return
		}
		try {
			if (message.text.substr(0, 1) === '!') {

				if (message.text.substr(0, 5) === '!coin' || message.text.substr(0, 5) === '!coinstatus') {
					coinStatusHandler.processCoinStatus(message)
					return
				}
				else {
					console.log('Not a coin command')
				}

				faqHandler.processFaq(message, debugging)
				//processFaq(message);
			}
		}
		catch (e) {
			if (debugging) {
				console.log('Couldn\'t match message.text.substr(0,1) === "!"')
				console.log(e)
			}
		}
	})
	rtm.start()
}
