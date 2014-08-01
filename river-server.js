/*jshint node: true, noempty: false, unused: false, newcap: false*/
var restify = require('restify');
var socketio = require('socket.io');
var request = require('request');
var OAuth = require('oauth');
var redis = require("redis");
var circular = require("circular-json");
var config = require('./config');


var oauth = new OAuth.OAuth(
    "https://api.twitter.com/oauth/request_token",
    "https://api.twitter.com/oauth/access_token",
    config.twitter.apikey,
    config.twitter.apisecret,
    "1.0",
    config.twitter.oauthauthorizeurl,
    "HMAC-SHA1"
);

var store = redis.createClient();
store.on("error", function(err) {
    console.log("Error " + err);
});


var server = restify.createServer();
server.use(restify.bodyParser());
server.use(restify.queryParser());
server.use(restify.jsonp());
server.use(restify.CORS());
server.use(restify.fullResponse());


var io = socketio.listen(server);
io.set('log level', 1);

var authtokens = [];
var users = {};
var sockets = {};


function respond(req, res, next) {
    res.send('hello ' + req.params.name);
}

function stats(req, res, next) {
    var statistics = {
        users: Object.keys(users).length,
        streams: Object.keys(sockets).length
    };
    res.send(200, statistics);
}

function authorize(req, res, next) {

    if (authtokens[req.query.oauth_token] !== null) {
        var user_token = authtokens[req.query.oauth_token];

        oauth.getOAuthAccessToken(req.query.oauth_token, authtokens[req.query.oauth_token], req.query.oauth_verifier,
            function(error, oauth_access_token, oauth_access_token_secret, results) {
                if (error) {
                    console.log(error);
                    res.send(401, "Authentication Failure!");
                } else {
                    users[user_token].oauth_access_token = oauth_access_token;
                    users[user_token].oauth_access_token_secret = oauth_access_token_secret;
                    users[user_token].hasTwitterAuth = true;

                    console.log('Authorized user: %s', user_token);

                    res.header('Location', 'https://deny.io/river/');
                    res.send(302, '');
                }
            }
        );

    } else {
        res.send(400, '');
    }
}




function oauth_login(req, res, next) {

    if (req.query.login_token) {
        if (users[req.query.login_token]) {

            oauth.getOAuthRequestToken(function(error, oauth_token, oauth_token_secret, results) {
                if (error) {
                    console.log(error);
                    res.send("Authentication Failed!");
                } else {
                    var session_oauth = {
                        token: oauth_token,
                        token_secret: oauth_token_secret
                    };

                    var user_token = req.query.login_token;
                    users[user_token].oauth_token = oauth_token;
                    users[user_token].oauth_token_secret = oauth_token_secret;

                    authtokens[oauth_token] = user_token;

                    console.log('Attempting to authorize user: %s', user_token);

                    res.header('Location', 'https://api.twitter.com/oauth/authorize?oauth_token=' + oauth_token);
                    res.send(302, '');
                }
            });

        } else {
            res.header('Location', 'https://deny.io/river/');
            res.send(302, '');
        }

    } else {
        res.send(400, '');
    }

}

function login(req, res, next) {

    if (req.params.login_token) {
        if (users[req.params.login_token]) {

            res.json(200, {
                login_token: req.params.login_token,
                hasTwitterAuth: users[req.params.login_token].hasTwitterAuth
            });
        } else {
            //console.log('user does not exist for token %s', req.params.login_token);
            res.header('Location', 'https://deny.io/river/register');

            res.send(303, '');

        }
    } else {
        res.header('Location', 'https://deny.io/river/register');

        res.send(303, '');
    }
}

function register(req, res, next) {
    //console.log('making new user');
    var login_token = generateToken(128);

    var user = {};
    user.hasTwitterAuth = false;
    users[login_token] = user;

    var user_data = {};
    user_data.login_token = login_token;
    user_data.hasTwitterAuth = false;

    console.log('Created new user: %s', circular.stringify(user_data));
    res.json(201, user_data);
}

function logout(req, res, next) {
    if (req.params.login_token) {
        users[req.params.login_token].stream.disconnect();
        users[req.params.login_token] = null;
        console.log('Deleted user: %s', req.params.login_token);
    }
    res.send(200, '');
}

function generateToken(bytes) {
    var token = require('crypto').randomBytes(bytes).toString('hex');

    return token;
}


function timeline(req, res, next) {

    if (req.params.login_token) {

        var user_token = req.params.login_token;
        if (users[user_token]) {
            if (users[user_token].hasTwitterAuth) {
                console.log('Get timeline from store for %s', user_token);

                store.get(user_token, function(err, result) {
                    if (!result) {

                        console.log('No timeline in store for %s', user_token);
                        oauth.get('https://api.twitter.com/1.1/statuses/home_timeline.json?count=50', users[user_token].oauth_access_token, users[user_token].oauth_access_token_secret,
                            function(e, data, resp) {
                                if (data.errors) {
                                    console.log('Twitter error when fetching timeline for %s, error: %s, response: %s', user_token, data, resp);
                                    res.json(200, data);
                                }
                                console.log('Got timeline from twitter for %s', user_token);
                                store.set(user_token, data, 'EX', 60, redis.print);
                                res.json(200, data);
                            });
                    } else {
                        res.json(200, result);
                    }
                });

            } else {
                res.send(401, '');
            }
        } else {
            res.send(401, '');
        }
    } else {
        res.send(400, '');
    }
}

function keywordstream(req, res, next) {

    if (req.params.login_token) {
        if (!users[req.params.login_token].stream) {

            var user_token = req.params.login_token;
            if (users[user_token]) {
                var stream = oauth.post("https://stream.twitter.com/1.1/statuses/filter.json?track=Magic2015", users[user_token].oauth_access_token, users[user_token].oauth_access_token_secret);

                console.log('Created keyword stream for %s', user_token);
                res.send(201, 'Created stream');

                users[user_token].stream = stream;

                // Response Parsing -------------------------------------------- //

                var clients = [];
                var buffer = "";
                var delim = /\n*\r\n*/;

                stream.addListener('response', function(response) {

                    //console.log('Stream active.');

                    response.setEncoding('utf8');

                    response.addListener("error", function(error){
                        console.log(error);
                    });

                    response.addListener("data", function(chunk) {

                        buffer += chunk;
                        var parts = buffer.split(delim);
                        var len = parts.length;

                        if (len > 1) {
                            buffer = parts[len - 1];
                            for (var i = 0, end = len - 1; i < end; ++i) {
                                var entry = parts[i];
                                if (entry !== "") {
                                    //console.log("Entry: '"+entry+"'");
                                    parse_stream(user_token, entry);
                                }
                            }
                        }
                    });

                    response.addListener("end", function(message) {
                        users[user_token].stream = null;
                        users[user_token].socket.emit('end', message);
                        console.log('End: %s', message);
                        console.log('--- END ---');
                    });

                });

                stream.end();
            }
        }
    }
}


function userstream(req, res, next) {

    if (req.params.login_token) {
        if (!users[req.params.login_token].stream) {

            var user_token = req.params.login_token;
            if (users[user_token]) {
                var stream = oauth.get("https://userstream.twitter.com/1.1/user.json?with=followings", users[user_token].oauth_access_token, users[user_token].oauth_access_token_secret);

                console.log('Created stream for %s', user_token);
                res.send(201, 'Created stream');

                users[user_token].stream = stream;

                // Response Parsing -------------------------------------------- //

                var clients = [];
                var buffer = "";
                var delim = /\n*\r\n*/;

                stream.addListener('response', function(response) {

                    //console.log('Stream active.');

                    response.setEncoding('utf8');

                    response.addListener("data", function(chunk) {

                        buffer += chunk;
                        var parts = buffer.split(delim);
                        var len = parts.length;

                        if (len > 1) {
                            buffer = parts[len - 1];
                            for (var i = 0, end = len - 1; i < end; ++i) {
                                var entry = parts[i];
                                if (entry !== "") {
                                    //console.log("Entry: '"+entry+"'");
                                    parse_stream(user_token, entry);
                                }
                            }
                        }
                    });

                    response.addListener("end", function(message) {
                        users[user_token].stream = null;
                        users[user_token].socket.emit('end', message);
                        console.log('End: %s', message);
                        console.log('--- END ---');
                    });

                });

                stream.end();
            }
        }
    }
}

function parse_stream(user, data) {
    var json_object = JSON.parse(data);
    //console.log(json_object.text);
    if (json_object.friends) {
        //do not need this yet
    } else if (json_object.event) {
        //do not need this yet
    } else if (json_object.warning) {
        //emit warning about server being too slow
        console.log('WARNING for %s', user);
        console.log(json_object.warning);

    } else if (json_object.scrub_geo) {
        //ignore
    } else if (json_object.limit) {
        //emit warning about limit
        console.log('Limit: %d', json_object.limit.track);

    } else if (json_object.disconnect) {
        //emit warning about disconnect
        console.log('Disconnect - Code %d - Reason: %s', json_object.disconnect.code, json_object.disconnect.reason);

    } else if (json_object.friends) {
        //ignore

    } else if (json_object.event && json_object.source && json_object.target) {
        //ignore

    } else if (json_object.retweeted_status) {
        users[user].socket.emit('retweet', json_object);

    } else if (json_object.delete) {
        users[user].socket.emit('delete', json_object);

    } else {
        users[user].socket.emit('tweet', json_object);

    }

}


function tweet(req, res, next) {

    if (req.params.login_token) {

        var user_token = req.params.login_token;
        if (users[user_token]) {

            if (users[user_token].hasTwitterAuth) {
                //console.log('Sending twitter message for %s', user_token);

                var reqdata = {};
                reqdata.status = req.params.message;

                oauth.post('https://api.twitter.com/1.1/statuses/update.json', users[user_token].oauth_access_token, users[user_token].oauth_access_token_secret, reqdata,
                    function(e, data, resp) {
                        console.log(data);
                        if (data.errors.message) {
                            console.log('Twitter error when sending twitter message for %s, error: %s, response: %s', user_token, data, resp);
                            res.json(200, data);
                        }
                        console.log('Sendt twitter message for %s', user_token);

                        res.json(201, data);
                    });

            } else {
                res.send(401, '');
            }
        } else {
            res.send(401, '');
        }
    } else {
        res.send(400, '');
    }
}

var streamsockets = io.of('/river/user/stream/socket').on('connection', function(socket) {
    var socket_id = generateToken(32);

    var socket_object = {};

    socket_object.socket_id = socket_id;
    socket_object.socket = socket;

    sockets[socket_id] = socket_object;

    socket.emit('challenge', {
        socket_id: socket_id
    });

    socket.on('rise', function(data) {
        if (sockets[data.socket_id]) {
            if (users[data.login_token]) {

                //If we already have an existing socket.io socket, kill it.
                if (users[data.login_token].socket) {
                    users[data.login_token].socket.disconnect();
                    users[data.login_token].socket = null;
                    console.log('Killed old socket.io connection from %s', data.login_token);
                }

                users[data.login_token].socket = socket;
                sockets[data.socket_id] = null;
                console.log('Accepted socket.io connection from %s', data.login_token);
                socket.emit('rise-accepted');
            } else {
                socket.disconnect();
                sockets[data.socket_id] = null;
            }
        } else {
            socket.disconnect();
            sockets[data.socket_id] = null;
        }
    });


});


server.get('/river/oauth/authorize', authorize);
server.get('/river/oauth/login', oauth_login);
server.post('/river/login', login);
server.get('/river/register', register);
server.post('/river/logout', logout);
server.get('/river/user/timeline', timeline);
server.get('/river/user/stream', userstream);
server.get('river/user/streamkeyword', keywordstream);
server.post('/river/user/tweet', tweet);
server.get('/river/stats', stats);

server.listen(config.web.port, function() {
    console.log('%s listening at %s', server.name, server.url);
});