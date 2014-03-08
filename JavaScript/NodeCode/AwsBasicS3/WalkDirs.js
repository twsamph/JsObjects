/**
 * @author Charlie Calvert
 */

var fs = require("fs");
var walk = require('walk');
var s3Code = require("./S3Code");

var winston = require('winston');


function setupWinston() {
	var config = {
		levels: {
			silly: 0,
			verbose: 1,
			info: 2,
			data: 3,
			warn: 4,
			debug: 5,
			error: 6
		},
		colors: {
			silly: 'magenta',
			verbose: 'cyan',
			info: 'green',
			data: 'grey',
			warn: 'yellow',
			debug: 'blue',
			error: 'red'
		}
	};

	var customLevels = {
		levels: {
			debug: 0,
			verbose: 1,
			info: 2,
			warn: 3,
			error: 4
		},
		colors: {
			debug: 'blue',
			verbose: 'cyan',
			info: 'green',
			warn: 'yellow',
			error: 'red'
		}
	};

	var logger = new (winston.Logger)({
		transports: [
			new (winston.transports.Console)({
				level: 'debug',
				colorize: true
			}),
		]
	});

	levels = customLevels.levels;
	colors = customLevels.colors;

	// logger.level = customLevels.levels.debug;
	// logger.add(winston.transports.File, { filename: './winston.log' });
	return logger;
}

function walkDirs(serverOptions) {
	var winstonLog = setupWinston();
	winstonLog.info(JSON.stringify(serverOptions, null, 4));

	if (serverOptions.reallyWrite) {
		winstonLog.log("details", "Loading config");
		s3Code.loadConfig(serverOptions.pathToConfig);
	}

	var options = {
		followLinks : false,
	};
	var myIndexFile = "<body>\n<html><ul>\n";

	// We care about S3 slashes, not ours
	var ensureFinalSlash = function(fileName) {
		var pathSep = '/';
		if (fileName.substring(fileName.length, 1) !== pathSep) {
			fileName = fileName + pathSep;
		}
		return fileName;
	};

	function validFile(fileName) {
		if (serverOptions.filesToIgnore.indexOf(fileName) === -1) {
			return true;
		} else {
			return false;
		}
	}

	function createIndexFile(dir, fileName) {
		winstonLog.detail("createIndexFile called");
		if (validFile(fileName)) {
			try {
				var file = "";
				if (dir.length > 0) {
					file = ensureFinalSlash(dir) + fileName;
				} else
					file = fileName;
				myIndexFile += '<li><a href=' + file + '>' + file + '</a>\n</li>';
			}
			catch(err) {
				winstonLog.log(err);
			}
		} else {
			winstonLog.log("info", "Skipping: " + fileName);
		}
	}

	function writeToDisk(fileName, content, nameOnS3) {
		fs.writeFile(fileName, content, function(err) {
			if(err) {
			  console.log(err);
			} else {
			  winstonLog.debug("IndexFile saved to " + fileName);
			  s3Code.writeFile(fileName, serverOptions.bucketName, nameOnS3, false);
			}
		});
	}

	winstonLog.log("debug", "walking: " + serverOptions.folderToWalk);

	var walker = walk.walk(serverOptions.folderToWalk, options);


	walker.on("names", function(root, nodeNamesArray) {
		winstonLog.debug("names called: " + root);
		nodeNamesArray.sort(function(a, b) {
			if (a > b)
				return 1;
			if (a < b)
				return -1;
			return 0;
		});
	});

	walker.on("directories", function(root, dirStatsArray, next) {
		winstonLog.debug("Directory Found: " + root);
		// dirStatsArray is an array of `stat` objects with the additional attributes
		// * type
		// * error
		// * name
		if (typeof dirStatsArray != 'undefined')
			winstonLog.debug("Directories: " + dirStatsArray.type);
		next();
	});


	walker.on("file", function(root, fileStats, next) {
		winstonLog.verbose('In File, the Root: ' + root);
		// winstonLog.log("fileStats.name: " + fileStats.name);
		if (fileStats.name === 'upLoadMe.html') {
			console.log(fileStats);
			console.log(root);
		}
		if (validFile(fileStats.name)) {
			var localFileName = root + "/" + fileStats.name;
			var pieces = root.split('/');
			winstonLog.log("debug", "Pieces of root: " + pieces);
			var s3Dir = "";
			// not in root of upload dir
			if (pieces.length >= 2) {
				s3Dir = pieces[pieces.length - 1];
			}

			// Build the index file
			if (serverOptions.createIndex) {
				try {
					createIndexFile(s3Dir, fileStats.name);
				} catch(err) {
					winstonLog.log(err);
				}
			}

			// If we are going to put it in a folder on S3
			if (serverOptions.createFolderToWalkOnS3) {
				if (s3Dir.length > 0) {
					s3Dir = ensureFinalSlash(serverOptions.s3RootFolder) + s3Dir;
				} else {
					s3Dir = serverOptions.s3RootFolder;
				}
			}

			// Don't put a slash in front of files in root
			if (s3Dir.length > 0) {
				var s3Name = ensureFinalSlash(s3Dir) + fileStats.name;
			} else {
				s3Name = fileStats.name;
			}
			winstonLog.verbose("s3Name: " + s3Name);
			if (serverOptions.reallyWrite) {
		 		s3Code.writeFile(localFileName, serverOptions.bucketName, s3Name, false);
		 	}

			winstonLog.log("debug", "leaving file");
		} else {
			winstonLog.verbose("Ignoring: " + fileStats.name);
		}
		next();
	});

	walker.on("errors", function(root, nodeStatsArray, next) {
		winstonLog.log("Error", "Error: " + root);
		next();
	});

	walker.on("end", function() {
		winstonLog.log("info", "all done");
		var indexName = "index.html";

		if (serverOptions.createIndex && serverOptions.reallyWrite) {
			myIndexFile += '\n</ul>\n</body>\n</html>'
			writeToDisk(indexName, myIndexFile, ensureFinalSlash(serverOptions.s3RootFolder) + indexName);
		}

		/* if (serverOptions.createFolderToWalkOnS3) {
			var indexNameOnS3 = 'CloudNotes.html';
			indexNameOnS3 = ensureFinalSlash(serverOptions.folderToWalk) + indexNameOnS3;
		}*/
	});

}

exports.walkDirs = walkDirs;