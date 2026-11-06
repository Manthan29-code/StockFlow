const { ipcMain } = require('electron');
const { calculateDeducted } = require('@stockflow/shared');

function registerCalcIpc() {
  ipcMain.handle('calc:deducted', (event, { deductBy, qty, pieceWeight }) => {
    try {
      return calculateDeducted({ deductBy, qty, pieceWeight });
    } catch (err) {
      return { error: err.message };
    }
  });
}

module.exports = {
  registerCalcIpc,
};

