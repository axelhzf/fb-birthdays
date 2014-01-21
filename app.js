var express = require('express');
var http = require('http');
var path = require('path');
var graph = require("fbgraph");
var everyauth = require("everyauth");
var _ = require("underscore");

var configuration = {
  client_id : process.env.FB_CLIENT_ID,
  client_secret : process.env.FB_CLIENT_SECRET,
  scope : "user_about_me, user_birthday, friends_birthday"
};

everyauth.facebook
  .appId(configuration.client_id)
  .appSecret(configuration.client_secret)
  .scope(configuration.scope)
  .handleAuthCallbackError(function (req, res) {
    console.log("ERROR", req, res);
  })
  .findOrCreateUser(function (session, accessToken, accessTokExtra, fbUserMetadata) {
    session.accessToken = accessToken;
    return {accessToken : accessToken};
  })
  .redirectPath('/')
  .entryPath('/auth/facebook');


var app = express();

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(express.cookieParser());
app.use(express.cookieSession({ secret : 'tobo!', cookie : { maxAge : 60 * 60 * 1000 }}));
app.use(everyauth.middleware());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

var monthNames = [ "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December" ];


function parseFriends (friends) {
  _.each(friends, function (friend) {
    friend.birthdayDate = new Date(friend.birthday);
  });
  return friends;
}

function friendsByBirthMonth (friends) {
  return _.chain(friends)
    .map(function (friend) {
      friend.birthdayDate = new Date(friend.birthday);
      return friend;
    }).sortBy(function (friend) {
      return friend.birthdayDate.getDate();
    }).groupBy(function (friend) {
      return friend.birthdayDate.getMonth();
    }).map(function (friends, monthNumber) {
      return {
        month : monthNames[monthNumber] || "Date not available",
        friends : friends
      }
    }).value();
}

function friendsByAge (friends) {
  return _.groupBy(friends, function (friend) {
    if (_.isUndefined(friend.birthday) || friend.birthday.length < 10) {
      return "Age not available"
    }
    return new Date().getFullYear() - friend.birthdayDate.getFullYear();
  });
}

app.get('/', function (req, res) {

  if (req.loggedIn) {
    var renderContext = {};

    graph.setAccessToken(req.session.accessToken);
    graph.get("/me", {fields : "picture"}, function (err, meResponse) {
      renderContext.image = meResponse.picture.data.url;
      graph.get("/me/friends", {fields : "birthday,picture,name,username"}, function (err, friendsResponse) {
        var friends = parseFriends(friendsResponse.data);
        renderContext.friendsByMonth = friendsByBirthMonth(friends);
        renderContext.friendsByAge = friendsByAge(friends);
        res.render("index", renderContext);
      });
    });
  } else {
    res.render("index");
  }
});


http.createServer(app).listen(app.get('port'), function () {
  console.log('Express server listening on port ' + app.get('port'));
});
