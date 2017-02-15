var request = require("request");
var http = require("http");
var path = require("path");
var fs = require("fs");
var crypto = require("crypto");
var requesting = {};
var AgentHttp = require('socks5-http-client/lib/Agent');
var AgentHttps = require('socks5-https-client/lib/Agent');
var proxyConfig = {
  agentOptions: {
    socksHost: process.env.proxy_host || '10.0.0.13', // Defaults to 'localhost'.
    socksPort: process.env.proxy_port || 1080 // Defaults to 1080.
  }
}
var cacheDir = process.cwd() + "/cache";
// 创建所有目录
var mkdirs = function (dirpath, callback) {
  fs.exists(dirpath, function (exists) {
    if (exists) {
      callback && callback(dirpath);
    } else {
      //尝试创建父目录，然后再创建当前目录
      mkdirs(path.dirname(dirpath), function () {
        fs.mkdir(dirpath, callback);
      });
    }
  });
};
var rmdirSync = (function () {
  function iterator(url, dirs) {
    var stat = fs.statSync(url);
    if (stat.isDirectory()) {
      dirs.unshift(url); //收集目录
      inner(url, dirs);
    } else if (stat.isFile()) {
      fs.unlinkSync(url); //直接删除文件
    }
  }

  function inner(path, dirs) {
    var arr = fs.readdirSync(path);
    for (var i = 0, el; el = arr[i++];) {
      iterator(path + "/" + el, dirs);
    }
  }
  return function (dir, cb) {
    cb = cb || function () {};
    var dirs = [];

    try {
      iterator(dir, dirs);
      for (var i = 0, el; el = dirs[i++];) {
        fs.rmdirSync(el); //一次性删除所有收集到的目录
      }
      cb()
    } catch (e) { //如果文件或目录本来就不存在，fs.statSync会报错，不过我们还是当成没有异常发生
      e.code === "ENOENT" ? cb() : cb(e);
    }
  }
})();
mkdirs(cacheDir);
var httpServer = http.createServer(function (req, res) {
  console.log('get req:', req.url);
  req.addListener('end', function () {
    var rootUrl = req.url.split('/')[1];
    switch (rootUrl) {
      case 'f_del_file':
        deleteCache(req, res);
        break;
      case 'f_del_dir':
        deleteCache(req, res, true);
        break;
      default:
        createCache(req, res);
    }
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

function getHost(host, protocol, path) {
  var hosts = host.replace(/\.cache.*\:/, ':').split('_'),
    result = [];
  if (hosts.length > 1) {
    result[0] = hosts[1];
    result[1] = hosts[2].split(':')[0];
    if (protocol) {
      result[0] = [hosts[0], hosts[1]].join('://')
    }
  } else {
    result = hosts;
  }
  return result.join(path ? '/' : ':')
}

//判断是否走代理
function getProxy(host) {
  var match = host.match(/cache\.([^\:\.\/]+)/);
  return match && match.length > 1 ? match[1] == 'proxy' : false;
}

function getProtocol(url) {
  console.log("protocol is:", url.split(':')[0]);
  return url.split(':')[0];
}

function toCachePath(req) {
  var fileName = req.url.split('/').pop();
  return path.join(cacheDir, getHost(req.headers.host, false, true), fileName ? req.url : [req.url, '/index'].join(''));
}

function toCacheDir(req) {
  var paths = req.url.split('/');
  var fileName = paths.pop();
  return path.join(cacheDir, getHost(req.headers.host, false, true), fileName ? paths.join('/') : req.url);
}

function deleteCache(req, response, isDir) {
  var target = toCachePath(req).replace(/f_del_\w+?\//, '');
  var callback = function (err) {
    if (err) {
      response.writeHead(400, {
        "Content-Type": "text/plain"
      });
    } else {
      response.writeHead(202, {
        "Content-Type": "text/plain"
      });
    }
    response.end();
  };
  if (isDir) {
    target = target.split('/');
    target.pop();
    rmdirSync(target.join('/'), callback)
  } else {
    fs.unlink([target, 'cache'].join('.'), callback)
  }
}

function createCache(req, res) {
  console.log("begin create cache", req.method, req.headers.host, req.url);

  var target = toCachePath(req);
  var dir = toCacheDir(req);
  var tempTarget = toTmpPath(req) + "." + Math.random().toString(36).substring(7) + ".tmp";
  var remoteTarget = [getHost(req.headers.host, true), req.url].join('');
  console.log("remote target:", remoteTarget);
  console.log("local target:", target, " dir:", dir);
  var s = Date.now();
  var clientRequest, enable_proxy = getProxy(req.headers.host),requestingId=[remoteTarget,enable_proxy?'_proxy':''].join('');
  if (!requesting[requestingId]) {
    console.log("enable_proxy:", enable_proxy);
    clientRequest = request(Object.assign({
      url: remoteTarget,
    }, enable_proxy ? Object.assign({
      agentClass: getProtocol(remoteTarget) == 'http' ? AgentHttp : AgentHttps,
    }, proxyConfig) : {}));
    requesting[requestingId] = [];
  } else {
    console.log("in cacheing")
    requesting[requestingId].push(res);
    return;
  }
  var cacheWrite = new Promise(function (resolve, reject) {
    clientRequest.on("error", function (err) {
      console.log('fail get response:', err);
      delete requesting[requestingId];
      reject(err);
    });
    clientRequest.on("response", function (clientRes) {
      if (clientRes.statusCode === 200 && req.method == "GET") {
        clientRequest.pipe(fs.createWriteStream(tempTarget));
        promiseFromStream(res)
          .then(function () {
            mkdirs(dir, function () {
              fs.rename(tempTarget, [target, 'cache'].join('.'), function () {
                var file = fs.createReadStream([target, 'cache'].join('.'));
                requesting[requestingId].forEach(function (item) {
                  file.pipe(item)
                })
                delete requesting[requestingId];
                resolve(true)
              })
            })
          })
      } else {
        resolve(promiseFromStream(res));
        delete requesting[requestingId];

      }
      console.log("success get response:", req.url);
      clientRequest.pipe(res);
    });

  });

  cacheWrite.then(function () {
    console.log("Cache CREATED in", Date.now() - s, "ms for", [getHost(req.headers.host, true), req.url].join(''), " ; saved in:", target, '\n');
  });

  return cacheWrite;
}


httpServer.listen(2080,'0.0.0.0');
