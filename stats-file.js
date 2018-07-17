const CONFIGURATION = require('./configuration-local.json')
const fs = require('fs')
const logFile = fs.createWriteStream(CONFIGURATION['script-path'] + 'faq-stats.txt', {flags: 'a'})
// Or 'w' to truncate the file every time the process starts.

stats = function(commandingUser, statsArray) {
	if (statsArray[1] !== undefined && statsArray[1].indexOf('@U') > -1) {
		logFile.write(+ new Date() + ',' + commandingUser + ',' + statsArray[1] + ',' + statsArray + '\n')
	} else {
		logFile.write(+ new Date() + ',' + commandingUser + ',undefined,' + statsArray + '\n')
	}
}
