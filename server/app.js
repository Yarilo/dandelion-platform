'use strict';

require('prototypes');
var express = require('express');
var app = express();
var logger = require('morgan');
var multipart = require('connect-multiparty');
var multipartMiddleware = multipart();
var bodyParser = require('body-parser');
var jsonParser = bodyParser.json();
var http = require('http');

var TIMEOUT_PERIOD = 30*60*1000;  //30 min for long uploads from desktop client (currently not resumables)
var routes =
{
	auth: require('./routes/auth.js'),
	users: require('./routes/users.js'),
	fs: require('./routes/resources.js'),
	state: require('./routes/state.js'),
	p2p: require('./routes/p2p.js'),
	upload: require('./routes/upload.js'),
};


app.use(logger("common"));

app.post('/api/login', jsonParser, routes.auth.login); //TODO/FIX: BEWARE: JSON PARSER had issues with something because change request, don't remember what.
app.use(routes.auth.authenticate);
app.use('/api/resources/*', routes.users.hasPermission);
//app.use('/api/status/encrypted/', routes.users.hasPermission);
app.use('/api/encrypt/*', routes.users.hasPermission);
app.use('/api/decrypt/*', routes.users.hasPermission);

app.get('/api/status/encrypted/*',routes.fs.isEncrypted);
app.put('/api/encrypt/*', routes.fs.encryptResource);
app.put('/api/decrypt/*', routes.fs.decryptResource);

app.get('/api/resources/*',routes.fs.getResource);
app.put('/api/resources/dirs/*',routes.fs.createDirectory);
app.move('/api/resources/*',routes.fs.moveResource);

app.put('/api/resources/*',routes.fs.putResource);
app.delete('/api/resources/*',routes.fs.deleteResource);

//create public token
app.get('/api/public-token/:id', routes.auth.getPublicToken);

//Partial, resumable uploads
//TODO: Permissions here
app.post('/api/chunks/', multipartMiddleware,routes.upload.postUpload);
app.options('/api/chunks/', routes.upload.checkOptions);
app.get('/api/chunks/', routes.upload.testChunks);
app.get('/api/chunks/download/:identifier',routes.upload.downloadId);


//Users, FIX: Any user can create/edit other users, use ACL with this.
app.put('/api/users/password/forgot/',jsonParser,routes.auth.sendRecoveryMail);
app.post('/api/users/password/reset/:token', routes.auth.resetPassword);
app.put('/api/users/password/:id', routes.auth.setPasswordInMongo);
app.put('/api/users/share/:id', routes.users.shareWithUser);
app.put('/api/users/validate/:token', routes.auth.validateUser);
app.get('/api/users/', routes.users.getAllUsers);
app.get('/api/users/:id',routes.users.getUserResources); // TODO: Ruta para consultar un recurso en concreto, o modificar esta.
app.put('/api/users/:id',jsonParser, routes.auth.createUser);
app.post('/api/users/:id', jsonParser,routes.users.updateUser);
app.delete('/api/users/:id', routes.auth.deleteUser);


//P2P Permissions!!
app.get('/api/p2p/magnet/*', routes.p2p.createMagnet);
app.get('/api/p2p/torrent/*', routes.p2p.createTorrent);


//State list -> Permissions
app.get('/api/state/', routes.state.generateList);
app.get('/api/state/list/', routes.users.getUserResources);

var server = http.createServer(app);
server.timeout = TIMEOUT_PERIOD;
server.listen(3000, function ()
{
	var host = this.address().address;
	var port = this.address().port;
	console.log('Dandelion node app listening at http://%s:%s', host, port);
});
