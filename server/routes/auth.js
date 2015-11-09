'use strict';

var mongodb = require('../util/mongodb.js');
var bcrypt = require('bcrypt');
var async = require('async');
var settings = require('../settings.js');
var crypto = require('crypto');
var nodemailer = require('nodemailer');
var mg = require('nodemailer-mailgun-transport');
var smtpTransport = nodemailer.createTransport(mg(settings.MAILGUN_AUTH));
var fs = require('fs-extra');
var request = require('request');
var settings = require('../settings.js');
var consistency = require('../util/consistency.js');
var mongoDriver = require('mongodb');
var jwt = require('jsonwebtoken');

exports.setPasswordInMongo = function (request, response)
{
		var username = request.params.id;
		var password = request.query.newpass;
		bcrypt.hash(password, 10, function(error, hash)
		{
			// Store hash in your password DB.
			var user =
			{
				name: username,
				password: hash
			};
			mongodb.updateUser({name:username}, user, function(error)
			{
					if(error)
					{
						console.log("Could not save user in DB");
						response.sendStatus(500);
						return;
					}
					console.log("User successfully saved");
					response.sendStatus(200);
				});
		});
};

exports.createUser = function(request, response)
{
	async.waterfall([generateRandomToken(request),
					checkUnique,
					createUserFolder,
					createUserInDB,
					sendValidationMail],
	function(error, result)
	{
		if(error)
		{
			return response.status(500).send(error);
		}
		return response.send(result);
	});
};

function checkUnique(request, token, callback)
{
	mongodb.findUsers({name: request.body.name}, function(error, users)
		{
			if(error)
			{
				return callback(error);
			}
			if(users.length > 0)
			{
				return callback("NAME_NOT_UNIQUE");
			}
			mongodb.findUsers({email: request.body.email}, function(error, users)
			{
				if(users.length > 0)
				{
					return callback("MAIL_NOT_UNIQUE");
				}
				if(error)
				{
					return callback(error);
				}
				return callback(error, request, token);
			});
		});
}
function createUserFolder(request, token, callback)
{
	var username = exports.getUser(request);
	var userFolder = settings.DATA_PATH + "/"+  username;
	fs.mkdir(userFolder, "0777", function(error) //TODO: CHECK
	{
		return callback(error, request, token);
	});
}

function createUserInDB(request, token, callback)
{
	bcrypt.hash(request.body.password, 10, function(error, hash)
	{
		var user =
		{
			name: exports.getUser(request),
			password: hash,
			email : request.body.email,
			validationToken : token,
		  	validationExpires : Date.now() + 3600000, // 1 hour
		};
		if(error)
		{
			return callback(error);
		}
		mongodb.createUser(user, function(error)
		{
			return callback(error, request, token, user);
		});
	});
}

function sendValidationMail(request, token, user, callback)
{
	var mailOptions =
	{
	  to: user.email,
	  from: 'account@dandelion.com',
	  subject: 'Dandelion - Validación de cuenta',
	  text:
		'Para finalizar con el proceso de creación de cuenta, haz click en el siguiente link o bien pégalo en la barra de tu navegador:\n\n' +
		'http://' + request.headers.host + '#/validate/' + token + '\n\n' +
		'El link será válido durante una hora. \n\n' +
		'Si no has solicitado esto, por favor ignora este mail.'
	};
	smtpTransport.sendMail(mailOptions, function(error)
	{
		return callback (error, 'done');
  	});
 }

exports.getPublicToken = function(request, response)
{
	var user = exports.getUser(request);
	var resourceId = request.params.id;
	mongodb.getResources({_id: mongoDriver.ObjectID(resourceId)}, user, function(error, result)
	{
		var resource = result [0];
		if(!resource)
		{
			return response.send(404);
		}
		if(resource.publicToken)
		{
			return response.send(resource.publicToken).status(200);
		}
		crypto.randomBytes(20, function(error, buf)
		{
			if(error)
			{
				return response.send(error).status(500);
			}
			var publicToken = buf.toString('hex');
			mongodb.updateResource(resourceId, user, {publicToken: publicToken }, function(error)
			{
				if(error)
				{
					return response.send(error).status(500);
				}
				return response.send(publicToken).status(200);
			});
		});
	});
};

function isPublicTokenValid (request, response, callback)
{
		var username = exports.getUser(request);
		var resourceName = request.url.substringFrom("/resources/").substringUpTo("?");
		resourceName = decodeURI(resourceName);
		var publicToken = request.query.public_token;
		if(!publicToken || !resourceName)
		{
			return callback(null, false);
		}
		mongodb.getResources({name: resourceName}, username, function(error, result)
		{
			if (error)
			{
				return callback("Error comparing token" + error , false);
			}
			if(result [0] && result[0].publicToken === publicToken)
			{
				return callback(null, true);
			}
			return callback(null, false);
		});
}

exports.validateUser = function(request, response)
{
	async.waterfall([findUserFromValidationToken(request),
					updateUserStatus,
					sendConfirmationMail],
	function(error, result)
	{
		if(error)
		{
			return response.status(500).send(error);
		}
		return response.send(result);
	});
};

function findUserFromValidationToken(request, callback)
{
	return function(callback)
	{
		mongodb.findUsers({validationToken: request.params.token, validationExpires: { $gt: Date.now() }},function(error, users)
		{
			if(users.length < 1)
			{
				var errorMessage = "User with token " + request.params.token + " is not found";
				return callback(errorMessage);
			}
			var user = users[0];
			return callback(error, request, user);
		});
	};
}

function updateUserStatus(request, user, callback)
{
	mongodb.deleteFields({name:user.name}, {validationToken:"", validationExpires:""},function(error)
	{
		return callback(error, request, user);
	});
}

function sendConfirmationMail(request, user, callback)
{
	var mailOptions =
	{
	   to: user.email,
	   from: 'account@dandelion.com',
	   subject: 'Dandelion - Cuenta activada',
	   text: 'Hola,\n\n' +
		 'Esto es una confirmación de que tu cuenta para ' + user.name + ' está ahora activada. \n'
	 };
	smtpTransport.sendMail(mailOptions, function(error)
	{
	  return callback (error, user.name);
	});
}

exports.resetPassword = function(request, response)
{
	async.waterfall([findUserFromToken(request),
					updatePassword,
					sendPasswordChangedMail],
	function(error, result)
	{
		if(error)
		{
			return response.status(500).send(error);
		}
		return response.send(result);
	});
};

function findUserFromToken(request, callback)
{
	return function(callback)
	{
		mongodb.findUsers({resetPasswordToken: request.params.token, resetPasswordExpires: { $gt: Date.now() }},function(error, users)
		{
			if(users.length < 1)
			{
				var errorMessage = "User with token " + request.params.token + " is not found";
				return callback(errorMessage);
			}
			var user = users[0];
			return callback(error, request, user);
		});
	};
}

function updatePassword(request, user, callback)
{
	var password = request.query.password;
	bcrypt.hash(password, 10, function(error, hash)
	{
		if(error)
		{
			return callback(error);
		}
		mongodb.deleteFields({name:user.name}, {resetPasswordToken:"", resetPasswordExpires:""},function(error)
		{
			if(error)
			{
				return callback(error);
			}
			mongodb.updateUser({name:user.name}, {password:hash}, function(error)
			{
				return callback(error, request, user);
			});
		});
	});
}

function sendPasswordChangedMail(request, user, callback)
{
	var mailOptions =
	{
	   to: user.email,
	   from: 'account@dandelion.com',
	   subject: 'Dandelion - Contraseña cambiada',
	   text: 'Hola,\n\n' +
		 'Esto es una confirmación de que tu contraseña para ' + user.name + ' acaba de ser cambiada.\n'
	 };
	smtpTransport.sendMail(mailOptions, function(error)
	{
	  return callback (error, user.name);
  	});
 }

exports.sendRecoveryMail = function(request, response)
{
	async.waterfall([generateRandomToken(request),
					addTokenToUser,
					sendResetPasswordMail],
	function(error, result)
	{
		if(error)
		{
			return response.status(500).send(error);
		}
		return response.sendStatus(200);
	});
};

function generateRandomToken(request, callback)
{
	return function(callback)
	{
		crypto.randomBytes(20, function(error, buf)
		{
			var token = buf.toString('hex');
			return callback(error,request,token);
		});
	};
}

function addTokenToUser(request, token, callback)
{
	var email = request.body.email;
	mongodb.findUsers({email:email}, function(error, users)
	{
		if(users.length < 1)
		{
			return callback("MAIL_NOT_FOUND");
		}
		var user = users [0];
		user.resetPasswordToken = token;
	  	user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
		mongodb.updateUser({email:email},user, function(error)
		{
			return callback(error, request, token, user);
		});
	});
}

function sendResetPasswordMail(request, token, user, callback)
{
	var mailOptions =
	{
	  to: user.email,
	  from: 'account@dandelion.com',
	  subject: 'Dandelion - Contraseña olvidada',
	  text: 'Estás recibiendo este correo porque tú (u otra persona) ha olvidado la contraseña de su cuenta y desea resetearla.\n\n' +
		'Por favor haz click en el siguiente link o copia y pégalo en la barra de tu navegador.\n\n' +
		'http://' + request.headers.host + '#/reset/' + token + '\n\n' +
		'Este link será válido durante una hora.' + '\n\n' +
		'Si no has solicitado este cambio de contraseña, por favor, ignora este mail y tu contraseña no será cambiada.\n'
	};
	smtpTransport.sendMail(mailOptions, function(error)
	{
	  return callback (error, 'done');
  	});
 }

//Poner todas las funciones aquí dentro
exports.deleteUser = function(request, response)
{
	async.waterfall([getUserData(request),
					deleteSharedResources,
					deleteUserFromDB,
					deleteUserResources,
					sendAccountDeletedMail],
	function(error, result)
	{
		if(error)
		{
			return response.status(500).send(error);
		}
		return response.sendStatus(200);
	});
};

function getUserData(request, callback)
{
	var username = exports.getUser(request);
	return function(callback)
	{
		mongodb.getUser(username, function(error, user)
		{
			return callback(error, username, user.email);
		});
	};
}

function deleteSharedResources(username, email, callback)
{
	mongodb.getAllUserResources(username, function(error, resourcesArray)
	{
		if(error)
		{
			return callback(error);
		}
		var tasks = [];
		resourcesArray.forEach(function(resource)
		{
			if(resource.owner === username)
			{
				tasks.push(getConsistencyDeleter(resource, username));
			}
			if(resource.edit || resource.view)
			{
				tasks.push(getConsistencySharedDeleter(resource, username));
			}
		});
		async.series(tasks, function(error)
		{
			return callback(error, username, email);
		});
	});
}

function getConsistencyDeleter(resource, username)
{
	return function(callback)
	{
		return consistency.propagateDelete(resource, username, callback);
	};
}

function getConsistencySharedDeleter(resource, username)
{
	return function(callback)
	{
		return consistency.propagateRemovedSharedStatus(resource, username, callback);
	};
}
function deleteUserFromDB(username, email, callback)
{
	mongodb.deleteUser(username, function(error)
	{
		if(error)
		{
			return callback(error);
		}
		mongodb.deleteResourcesUserCollection(username,function(error)
		{
			return callback(error, username, email);
		});
	});
}

function deleteUserResources(username, email, callback)
{
	var uri =  settings.NGINX_ADDRESS + "/" + username + "/";
 	request({uri: uri,method:'DELETE'}, function(error, response)
	{
		return callback (error, username, email);
	});
}

function sendAccountDeletedMail(username, email, callback)
{
	var mailOptions =
	{
	  to: email,
	  from: 'account@dandelion.com',
	  subject: 'Dandelion - Cuenta eliminada',
	  text: 'Tu cuenta y todos sus archivos han sido eliminado satisfactoriamente.'
	};
	smtpTransport.sendMail(mailOptions, function(error)
	{
	  return callback (error, 'done');
  	});
}


exports.login = function(request, response)
{
	var username = request.body.user;
	var password = request.body.password;

	mongodb.getUser(username, function (error, user)
	{
		if (error)
		{
			console.log("Error while looking for db", error);
			return response.status(500).send(error);
		}
		if (!user)
		{
			return response.sendStatus(401);
		}
		bcrypt.compare(password, user.password, function (error, result)
		{
			if (error)
			{
				console.log("Error while comparing and hashing password", error);
				return response.status(500).send(error);
			}
			if (result)
			{
				var token = jwt.sign(user, settings.AUTHENTICATION_KEY,{expiresInMinutes: 1440}); //TODO: Change
				response.status(200).send({'token': token, 'username' :user.name});
			}
			else
			{	//invalida password
				return response.sendStatus(401);
			}
		});
	});
};

exports.authenticate = function(request, response, next)
{
	var token = exports.getToken(request);
	jwt.verify(token, settings.AUTHENTICATION_KEY, function(error, decoded) //TODO: Change
	{
		if (error)
	  	{
			checkOtherAuth(request, response, function(error, alternateAuth)
			{
				if(error)
				{
					return response.sendStatus(500);
				}
				if(!alternateAuth)
				{
					return response.status(403).send("Failed to authenticate token");
				}
				console.log("alternateAuth", alternateAuth);
				next();
			});
		}
		else
		{
			request.decoded = decoded;
			next();
		}
	});
};

function checkOtherAuth(request,response, callback)
{
	var user = exports.getUser(request);
	isPublicTokenValid(request, response, function(error, isValid)
	{
		if(error)
		{
			return callback(error, false);
		}
		if(isValid)
		{
			return callback(error, true);
		}
		if(request.url === '/api/users/password/forgot/' || request.url.contains('/api/users/password/reset/') || request.url.contains('/api/users/validate/'))
		{
			return callback(error, true);
		}
		if (user && request.query.initial_token === settings.INITIAL_TOKEN)
		{
			return callback(error, true);
		}
		return callback(error, false);
	});
}

exports.getUser = function(request)
{
	return request.header('user') || request.query.user || request.params.id;
};
exports.getPassword = function(request)
{
	return request.header('password') || request.query.password;
};

exports.getToken = function(request)
{
	 return request.query.token ||  request.headers['x-access-token'];
};
