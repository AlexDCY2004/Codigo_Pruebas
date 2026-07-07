const { app, BrowserWindow } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  // Guardamos si estamos en desarrollo en una variable limpia
  const isDev = !app.isPackaged || process.env.NODE_ENV === 'development';

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      // Si no usas preload por ahora, asegúrate de que no rompa la carga si el archivo no existe
      preload: path.join(__dirname, 'preload.js'), 
      contextIsolation: true,
      nodeIntegration: false
    },
    // Corregido: Si main.js está en la raíz, quitamos el '..'
    icon: path.join(__dirname, 'public', 'icon.png'),
    // En desarrollo la mostramos de una vez para debuguear; en producción la ocultamos hasta que esté lista
    show: isDev 
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // Corregido: Si main.js está en la raíz, dist está al mismo nivel, quitamos el '..'
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  // Este evento solo lo dejamos activo para producción (cuando show es false)
  if (!isDev) {
    mainWindow.once('ready-to-show', () => {
      mainWindow.show();
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
