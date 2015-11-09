'use strict';

var createTorrent = require('create-torrent');
var fs = require('fs');
var magnetLink = require('magnet-link');
var settings = require('../settings.js');
var resources = require('./resources.js');
var mongodb = require('../util/mongodb.js');
var auth = require('./auth.js');

exports.createMagnet = function(request, response)
{
	generateTorrent(request, function(error, torrentPath)
	{
		if (error && error.code !== 11000)
		{
			return response.status(500).send(error);
		}
		magnetLink(torrentPath, function (error, link)
		{
			if(error)
			{
				console.log("Couldn't generate magnet link", error);
				return response.status(500).send(error);
			}
			console.log("Generated magnet", link);
			return response.send(link);
		});
	});
};

exports.createTorrent = function(request, response)
{
	generateTorrent(request, function(error, torrentPath)
	{
		if(error)
		{
			return response.status(500).send(error);
		}
		return response.sendFile(torrentPath);
	});
};

function generateTorrent(request, callback)
{
	var user = auth.getUser(request);
	var resource = request.params[0];
	var path = settings.DATA_PATH + "/" + user + "/" + resource;
	createTorrent(path, function (error, torrent)
	{
		var torrentPath = path + ".torrent";
		if(error)
		{
			console.log("Couldn't create torrent", error);
			return callback(error, torrentPath);
		}
		var resource = resources.fillResource(request);
		resource.name +=".torrent";
		resource.owner = user;
		resource.locations = [torrentPath];
		mongodb.createResource(resource, user, function(error)
		{
			if(error)
			{
				console.log("Error inserting resource generating torrent", error);
				return callback(error, torrentPath);
			}
			fs.writeFile(torrentPath, torrent, function(error)
			{
				if(error)
				{
					console.log("Error writing torrent file", error);
					return callback(error);
				}
				return callback(null, torrentPath);
			});
		});
	});
}
