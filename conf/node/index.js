var request = require("request");
var http = require("http");
var path = require("path");
var filed = require("filed");
var fs = require("fs");
var crypto = require("crypto");

var cacheDir = process.cwd() + "/cache";
// 创建所有目录
var mkdirs = function (dirpath, callback) {
	fs.exists(dirpath, function (exists) {
		if (exists) {
			callback&&callback(dirpath);
		} else {
			//尝试创建父目录，然后再创建当前目录
			mkdirs(path.dirname(dirpath), function () {
				fs.mkdir(dirpath, callback);
			});
		}
	});
};

mkdirs(cacheDir);
var httpServer = http.createServer(function (req, res) {
	req.addListener('end', function () {
		createCache(req, res);
	}).resume();
});

function toTmpKey(req) {
	var h = crypto.createHash("sha1");
	h.update(req.url);
	return h.digest("hex");
}

function toTmpPath(req) {
	return path.join(cacheDir, toTmpKey(req));
}

function promiseFromStream(stream) {
	return new Promise(function (resolve, reject) {
		stream.on("error", reject);
		stream.on("end", resolve);
		stream.on("close", resolve);
		stream.on("finish", resolve);
	});
}
function getHost(host,protocol,path) {
	//https_registry.npmjs.org_443.cache.6-k.cc:443
	var hosts=host.replace(/\.cache.*\:/, ':').split('_'),result=[];
	if(hosts.length>1){
		result[0]=hosts[1];
		result[1]=hosts[2].split(':')[0];
		if(protocol){
			result[0]=[hosts[0],hosts[1]].join('://')
		}
	}else{
		result=hosts;
	}
	return result.join(path?'/':':')
}
function toCachePath(req) {
	var fileName=req.url.split('/').pop();
	return path.join(cacheDir, getHost(req.headers.host,false,true), fileName?req.url:[req.url,'index.html'].join(''));
}

function toCacheDir(req) {
	var paths = req.url.split('/');
	paths.pop();
	return path.join(cacheDir, getHost(req.headers.host,false,true), paths.join('/'));
}

function createCache(req, res) {
	console.log("createCache", req.method, req.headers.host,req.url);

	var target = toCachePath(req);
	var dir = toCacheDir(req);
	var tempTarget = toTmpPath(req) + "." + Math.random().toString(36).substring(7) +".tmp";

	console.log(getHost(req.headers.host,true));
	console.log("target:",target," dir:",dir)
	var s = Date.now();

	var clientRequest = request([getHost(req.headers.host,true), req.url].join(''));

	var cacheWrite = new Promise(function (resolve, reject) {
		clientRequest.on("error", reject);
		clientRequest.on("response", function (clientRes) {

			if (clientRes.statusCode === 200) {
				clientRequest.pipe(fs.createWriteStream(tempTarget));
				mkdirs(dir, function () {
					fs.rename(tempTarget,target,function () {
						resolve(true)
					})
				})
			} else {
				resolve(promiseFromStream(res));
			}
			console.log("get response:", req.url);
			clientRequest.pipe(res);
		});

	});

	cacheWrite.then(function () {
		console.log("Cache CREATED in", Date.now() - s, "ms for", req.method, req.url, target);
	});

	return cacheWrite;
}


httpServer.listen(2080);
