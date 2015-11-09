// Shameless extracted and adapted from: https://github.com/flowjs/flow.js/blob/master/samples/Node.js/flow-node.js
//Live is too short for writing a server side piece again
//TODO: Consider making this a separate server
//TODO: Make the recursive calls iterative for performance using flowTotalChunks
var fs = require('fs'),
	path = require('path');

module.exports = flow = function(temporaryFolder) {
	var self = this;
	self.temporaryFolder = temporaryFolder;
	self.maxFileSize = null;
	self.fileParameterName = 'file';

	try
	{
		fs.mkdirSync(self.temporaryFolder);
	} catch (e)
	{
		console.log("Error, unable to create folder", e);
	}
	function cleanIdentifier(identifier)
	{
		return identifier.replace(/[^0-9A-Za-z_-]/g, '');
	}

	function getChunkFilename(chunkNumber, identifier)
	{
		identifier = cleanIdentifier(identifier);
		// What would the file name be?
		return path.resolve(self.temporaryFolder, './flow-' + identifier + '.' + chunkNumber);
	}

	function validateRequest(chunkNumber, chunkSize, totalSize, identifier, filename, fileSize)
	{
		identifier = cleanIdentifier(identifier);

		// Check if the request is sane
		if (chunkNumber == 0 || chunkSize == 0 || totalSize == 0 || identifier.length == 0 || filename.length == 0) {
			return 'non_flow_request'; //TODO: este y el resto deberían ser 401
		}
		var numberOfChunks = Math.max(Math.floor(totalSize / (chunkSize * 1.0)), 1);
		if (chunkNumber > numberOfChunks) {
			return 'invalid_flow_request1';
		}

		// Is the file too big?
		if (self.maxFileSize && totalSize > self.maxFileSize) {
			return 'invalid_flow_request2';
		}

		if (typeof(fileSize) != 'undefined')
		{
			if (chunkNumber < numberOfChunks && fileSize != chunkSize)
			{
				// The chunk in the POST request isn't the correct size
				return 'invalid_flow_request3';
			}
			if (numberOfChunks > 1 && chunkNumber == numberOfChunks && fileSize != ((totalSize % chunkSize) + parseInt(chunkSize)))
			{
				// The chunks in the POST is the last one, and the fil is not the correct size
				return 'invalid_flow_request4';
			}
			if (numberOfChunks == 1 && fileSize != totalSize)
			{
				// The file is only a single chunk, and the data size does it
				return 'invalid_flow_request5';
			}
		}

		return 'valid';
	}

	//'found', filename, original_filename, identifier
	//'not_found', null, null, null
	self.get = function(req, callback)
	{
		var chunkNumber = req.param('flowChunkNumber', 0);
		var chunkSize = req.param('flowChunkSize', 0);
		var totalSize = req.param('flowTotalSize', 0);
		var identifier = req.param('flowIdentifier', "");
		var filename = req.param('flowFilename', "");

		if (validateRequest(chunkNumber, chunkSize, totalSize, identifier, filename) == 'valid')
		{
			var chunkFilename = getChunkFilename(chunkNumber, identifier);
			fs.exists(chunkFilename, function(exists)
			{
				if (exists)
				{
					callback('found', chunkFilename, filename, identifier);
				} else
				{
					callback('not_found', null, null, null);
				}
			});
		} else
		{
			callback('not_found', null, null, null);
		}
	};

	//'partly_done', filename, original_filename, identifier
	//'done', filename, original_filename, identifier
	//'invalid_flow_request', null, null, null
	//'non_flow_request', null, null, null
	self.post = function(req, callback) {

		var fields = req.body;
		var files = req.files;

		var chunkNumber = fields['flowChunkNumber'];
		var chunkSize = fields['flowChunkSize'];
		var totalSize = fields['flowTotalSize'];
		var identifier = cleanIdentifier(fields['flowIdentifier']);
		var relativePath = fields['flowRelativePath'];
		var filename = fields['flowFilename'];
		if(relativePath)
		{
			filename = relativePath + "/" + filename;
		}

		if (!files[self.fileParameterName] || !files[self.fileParameterName].size)
		{
			callback('invalid_flow_request', null, null, null);
			return;
		}

		var original_filename = files[self.fileParameterName]['originalFilename'];
		var validation = validateRequest(chunkNumber, chunkSize, totalSize, identifier, filename, files[self.fileParameterName].size);
		if (validation == 'valid') {
			var chunkFilename = getChunkFilename(chunkNumber, identifier);
			// Save the chunk (TODO: OVERWRITE)
			fs.rename(files[self.fileParameterName].path, chunkFilename, function() {

				// Do we have all the chunks?
				var currentTestChunk = 1;
				var numberOfChunks = Math.max(Math.floor(totalSize / (chunkSize * 1.0)), 1);
				var testChunkExists = function()
				{
					fs.exists(getChunkFilename(currentTestChunk, identifier), function(exists)
					{
						if (exists)
						{
							currentTestChunk++;
							if (currentTestChunk > numberOfChunks)
							{
								callback('done', filename, original_filename, identifier);
							} else
							{
								testChunkExists();
							}
						}
						else
						{
							callback('partly_done', filename, original_filename, identifier);
						}
					});
				};
				testChunkExists();
			});
		} else {
			callback(validation, filename, original_filename, identifier);
		}
	};

	// Pipe chunks directly in to an existsing WritableStream
	//   r.write(identifier, response);
	//   r.write(identifier, response, {end:false});
	//
	//   var stream = fs.createWriteStream(filename);
	//   r.write(identifier, stream);
	//   stream.on('data', function(data){...});
	//   stream.on('finish', function(){...});
	self.write = function(identifier, writableStream, options, callback)
	{
		options = options || {};
		options.end = (typeof options['end'] == 'undefined' ? true : options['end']);
		// Iterate over each chunk
		var pipeChunk = function(number) {

			var chunkFilename = getChunkFilename(number, identifier);
			fs.exists(chunkFilename, function(exists) {

				if (exists)
				{
					// If the chunk with the current number exists,
					// then create a ReadStream from the file
					// and pipe it to the specified writableStream.
					var sourceStream = fs.createReadStream(chunkFilename);
					sourceStream.pipe(writableStream, {
						end: false
					});
					sourceStream.on('end', function()
					{
						// When the chunk is fully streamed,
						// jump to the next one
						pipeChunk(number + 1);
					});
				} else
				{
					// When all the chunks have been piped, end the stream
					if (options.end)
					{
						writableStream.end();
					}
					if (options.onDone) options.onDone();
				}
			});
		};
		pipeChunk(1);
	};

	self.clean = function(identifier, options)
	{
		options = options || {};
		// Iterate over each chunk
		var pipeChunkRm = function(number)
		{
			var chunkFilename = getChunkFilename(number, identifier);
			//console.log('removing pipeChunkRm ', number, 'chunkFilename', chunkFilename);
			fs.exists(chunkFilename, function(exists)
			{
				if (exists)
				{
					console.log('exist removing ', chunkFilename);
					fs.unlink(chunkFilename, function(err)
					{
						if (err && options.onError) options.onError(err);
					});
					pipeChunkRm(number + 1);  //FIX: Don't know if a recursive call is the best idea here
				}
				else if (options.onDone)
				{
					options.onDone();
				}
			});
		};
		pipeChunkRm(1);
	};

	return self;
};
