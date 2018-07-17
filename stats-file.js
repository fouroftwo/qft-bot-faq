const CONFIGURATION = require('./configuration-local.json')
const fs = require('fs')
const logFile = fs.createWriteStream(CONFIGURATION['script-path'] + 'faq-stats.txt', {flags: 'a'})
// Or 'w' to truncate the file every time the process starts.

stats = function(statsString) {
	logFile.write(statsString + '\n')
}
