'use strict';
const electron = require('electron');
const app = electron.app;
const spawn = require("child_process").spawn; // spawns a python process
const exec = require('child_process').exec;
const config = require('./config.js');

var https = require("https");

// // pocketsphinx variables
var fs = require("fs");
var ps = require('pocketsphinx').ps;
var modelDir = "../pocketsphinx/model/en-us/";
var sphinxConfig = new ps.Decoder.defaultConfig();

// initialize config
sphinxConfig.setString("-hmm", modelDir + "en-us");
sphinxConfig.setString("-dict", modelDir + "cmudict-en-us.dict");
sphinxConfig.setString("-lm", modelDir + "en-us.lm.bin");
var decoder = new ps.Decoder(sphinxConfig);

// adds debug features like hotkeys for triggering dev tools and reload
require('electron-debug')();

// prevent window being garbage collected
let mainWindow;

function onClosed() {
	// dereference the window
	// for multiple windows store them in an array
	mainWindow = null;
}

function getAudioInput(){
  // for osx: ffmpeg -f avfoundation -i ":0" -t 3 -ar 16000 -ac 1 -sample_fmt s16 out.wav
  exec('ffmpeg -f avfoundation -i ":0" -t 2 -ar 16000 -ac 1 -sample_fmt s16 out.wav', function(){
    fs.readFile("out.wav", function(err, data) {
      if (err) throw err;
      decoder.startUtt();
      decoder.processRaw(data, false, false);
      decoder.endUtt();
      fs.unlink("out.wav");
      console.log(decoder.hyp());
      mainWindow.webContents.send("decode", decoder.hyp().hypstr);
    });
  })
}

function createMainWindow() {
	const win = new electron.BrowserWindow({
		width: 600,
		height: 400
	});

	win.loadURL(`file://${__dirname}/index.html`);
  win.setFullScreen(true);
  win.on('closed', onClosed);

  var process = spawn('python',["speech/srs.py", "speech/resources/snowboy.umdl",
   "speech/resources/weather.pmdl"]);

  process.stdout.on('data', function (data){
    var str = data.toString().trim();
    console.log(str);
    // change switch to record a voice message
    switch (str){
      case "weather":
        mainWindow.webContents.send("loading", true);
        getAudioInput();
        // let url = `https://api.forecast.io/forecast/${config.weather.key}/1.352083,103.819836?units=${config.weather.units}&exclude=minutely,hourly`
        // var request = https.get(url, function (response) {
        //   // data is streamed in chunks from the server
        //   // so we have to handle the "data" event
        //   var buffer = "",
        //   data,
        //   route;

        //   response.on("data", function (chunk) {
        //     buffer += chunk;
        //   });

        //   response.on("end", function (err) {
        //     data = JSON.parse(buffer);
        //     console.log(data);
        //     mainWindow.webContents.send("weather", data)
        //   });
        // });
      break
    }
    // mainWindow.webContents.send('keyword-spotted', str);
  });

  return win;
}

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
		app.quit();
	}
});

app.on('activate', () => {
	if (!mainWindow) {
		mainWindow = createMainWindow();
	}
});

app.on('ready', () => {
	mainWindow = createMainWindow();
});
