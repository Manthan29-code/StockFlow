const { registerAuthIpc } = require('./auth.ipc');
const { registerRequestIpc } = require('./request.ipc');
const { registerCalcIpc } = require('./calc.ipc');
const { registerExcelIpc } = require('./excel.ipc');
const { registerBackupIpc } = require('./backup.ipc');
const { registerSettingsIpc } = require('./settings.ipc');

function registerAllIpc() {
  registerAuthIpc();
  registerRequestIpc();
  registerCalcIpc();
  registerExcelIpc();
  registerBackupIpc();
  registerSettingsIpc();
}

module.exports = {
  registerAllIpc,
};

