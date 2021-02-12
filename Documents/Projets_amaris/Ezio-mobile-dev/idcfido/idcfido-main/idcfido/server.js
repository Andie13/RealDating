// server.js

const express = require("express");
const { v4: uuidv4 } = require('uuid');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync')
const nodemailer = require("nodemailer");
const fs = require('fs');

const crypto = require('crypto')
const https = require('https')
const session = require('express-session')
const memoryStore = require('memorystore')(session)

const adapter = new FileSync('.data/db.json')
const db = low(adapter);

const USERS = "users";
const SU_CODES = "suCodes";
const DB_DEFAULT = {};
DB_DEFAULT[USERS] = {};
DB_DEFAULT[SU_CODES] = {};

db.defaults(DB_DEFAULT)
  .write();

let mailer = nodemailer.createTransport({
    host: process.env.MAIL_SMTP,
    port: process.env.MAIL_PORT,
    secure: false,
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASSWORD,
    },
  });
const app = express();
app.set('trust proxy', 1);

// protocol check, if http, redirect to https
function checkHttps(req, res, next){
  let isHttps = (req.protocol == "https") ||
    (req.get('X-Forwarded-Proto') && req.get('X-Forwarded-Proto').indexOf("https")!=-1);
  if (isHttps || (req.hostname == "localhost")) {
    return next()
  } else {
    let httpsurl = 'https://' + req.hostname
    if (process.env.HTTPS_PORT) {
      httpsurl += ":" + process.env.HTTPS_PORT;
    }
    httpsurl += req.url;
    res.redirect(httpsurl);
  }
}
app.all('*', checkHttps)

// make all the files in 'public' available
// https://expressjs.com/en/starter/static-files.html
app.use(express.static("public"));
app.use(session({
  secret: 'dummy',
  resave: false,
  saveUninitialized: true,
  store: new memoryStore({
    checkPeriod: process.env.SESSION_TIMEOUT_SECONDS*1000 // prune period
  }),
  cookie: { 
    secure: true, 
    maxAge: process.env.SESSION_TIMEOUT_SECONDS*1000 // session expiration
  }
}));
app.use(express.json());

// set the view engine to ejs
app.set('view engine', 'ejs');

function ejsRender(request, response, file) {
  let params = {
    "ga_tag" : process.env.GA_TAG
  }
  if (request.session.isOpen) {
    params["username"] = request.session.email;
    params["userid"] = request.session.userId;
  }
  response.render(__dirname + "/views/" + file, params);
}
function isAdmin(request) {
  return ((request.session.isOpen)
    && (process.env.ADMINS.indexOf(request.session.demail)>=0));
}
function ifLoggedIn(request, response, file) {
  if (request.session.isOpen) {
    request.session.touch();
    ejsRender(request, response, file);
  } else {
    response.redirect("/");
  }
}
app.get("/", (request, response) => {
  ejsRender(request, response, "index");
});
app.get("/signup", (request, response) => {
  ejsRender(request, response, "signup");
});
app.get("/privacy", (request, response) => {
  ejsRender(request, response, "privacy");
});
app.get("/account", (request, response) => {
  ifLoggedIn(request, response, "account");
});
app.get("/transfer", (request, response) => {
  ifLoggedIn(request, response, "transfer");
});
app.get("/authentication", (request, response) => {
  ifLoggedIn(request, response, "authentication");
});
app.get("/logout", (request, response) => {
  request.session.isOpen = undefined;
  request.session.demail = undefined;
  request.session.email = undefined;
  request.session.userId = undefined;
  response.redirect("/");
});
/* TESTING */
app.get("/session", (request, response) => {
  request.session.isOpen = true;
  request.session.demail = "8379ed5490883247bdc049ed91dfcdfd895c5d789c5d91a047c32c1fba8dc7b6";
  request.session.email = "dummy@user.name";
  request.session.userId = "fake-testing-id";
  response.redirect("/transfer");
});
/* */

function getExpiration(delaySeconds) {
  return new Date().getTime() + (delaySeconds*1000);
}
function isExpired(exp) {
  return exp < new Date().getTime();
}


function isValidEmail(email) {
  const re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(email);
}

function digest(data) {
  return crypto.createHash("sha256")
    .update(data)
    .digest("hex").toLocaleLowerCase();
}

function getUserByDigestEmail(demail) {
  let user = db.get(USERS + "." + demail).value();
  if (user) {
    user.demail = demail;
  }
  return user;
}

function getUser(email) {
  if (isValidEmail(email)) {
    let demail = digest(email);
    return getUserByDigestEmail(demail);
  } else {
    throw new Error("Invalid email");
  }
}

function storeUser(user) {
  let userEntry = USERS + "." + user.demail;
  let demail = user.demail;
  user.demail = undefined;
  db.set(userEntry, user)
    .write();
  user.demail = demail;
}

function deleteUser(demail) {
  let userEntry = USERS + "." + demail;
  db.unset(userEntry)
    .write();
}

function newSignup(email) {
  let suCode =  uuidv4().replace(/\-/g, "");
  let suExpires = getExpiration(process.env.SIGNUP_TIMEOUT_SECONDS);
  db.set(SU_CODES + "." + suCode, {
    demail: digest(email),
    expires: suExpires
  }).write();
  return suCode;
}

function scenarioStart(scsName, user, txData, success, fail) {

  if (!user || !user.id) {
    fail("Invalid user");
    return;
  }
  const data = {
    "input": { "userId" : user.id },
    "name": scsName
  };
  if (txData) {
    data.input.transactionData = txData;
  }
  const jsonData = JSON.stringify(data);

  const options = {
    hostname: process.env.IDC_SCS_HOST,
    port: 443,
    path: process.env.IDC_SCS_PATH,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': jsonData.length,
      'x-api-key': process.env.IDC_SCS_APIKEY,
      'Authorization': 'Bearer ' + process.env.IDC_SCS_JWT
    }
  };

  const req = https.request(options, res => {

    if ((res.statusCode >= 200) && (res.statusCode < 300)) {
      res.on('data', d => {
        d = JSON.parse(d);
        console.log(`${scsName}:${d.id} created and ${d.status}`);
        if (d.status == "Waiting") {
          // store scenario id
          user.scs = {
            name: scsName,
            id: d.id,
            expires: getExpiration(process.env.SCENARIO_TIMEOUT_SECONDS)
          };
          user.lastUsed = new Date().getTime();
          storeUser(user);
          success(d);
        } else {
          fail(d.status);
        }
      });
    }
  });
  req.on('error', error => {
    console.error(`Failed to start scenario: ${error}`);
    fail(error);
  });
  req.write(jsonData);
  req.end();
}

// poll FIDO status
function scenarioPoll(id, user, success, fail) {
  if (!user || !user.scs || user.scs.id != id) {
    fail("Invalid user");
    return;
  }
  if (isExpired(user.scs.expires)) {
    user.scs = undefined;
    storeUser(user);
    fail("Login request expired");
    return;
  }
  // Get scenario status
  const options = {
    hostname: process.env.IDC_SCS_HOST,
    port: 443,
    path: process.env.IDC_SCS_PATH + "/" + user.scs.id,
    method: 'GET',
    headers: {
      'x-api-key': process.env.IDC_SCS_APIKEY,
      'Authorization': 'Bearer ' + process.env.IDC_SCS_JWT
    }
  }
  const req = https.request(options, res => {
    if ((res.statusCode >= 200) && (res.statusCode < 300)) {
      res.on('data', d => {
        d = JSON.parse(d);
        console.log(`${user.scs.name}:${user.scs.id} status is ${d.status}`)
        if (d.status == "Success") {
          // clear login
          user.scs = undefined;
          storeUser(user);
        }
        success(d.status);
      })
    }
  })
  req.on('error', error => {
    console.error(`Failed to poll scenario: ${error}`);
    fail(error);
  })
  req.end();
}

// request FIDO authentication
app.post("/login/:email", (request, response) => {
  let user = getUser(request.params.email);
  // Auth_FIDO
  scenarioStart(process.env.IDC_SCS_AUTH, user, undefined,
    function(res){
      request.session.email = request.params.email;
      request.session.demail = user.demail;
      // send scenario id
      response.send(res.id);
    }, function(err){
      response.status(500).send(err);
    }
  );
});

// request FIDO authentication
app.get("/login_status/:id", (request, response) => {
  let user = getUserByDigestEmail(request.session.demail);
  scenarioPoll(request.params.id, user,
    function(res) {
      if (res == "Success") {
        request.session.isOpen = true;
        request.session.userId = user.id;
      }
      response.send(res);
    },
    function (err) {
      response.status(404).send(err);
    }
  );
});

// request FIDO signature
app.post("/sign", (request, response) => {
  let user = getUserByDigestEmail(request.session.demail);
  let transactionData = JSON.stringify(request.body);
  // Sign_FIDO
  scenarioStart(
    process.env.IDC_SCS_AUTH, // TODO process.env.IDC_SCS_SIGN,
    user,
    undefined, // TODO transactionData,
    function(res){
      response.send(res.id);
    },
    function(err){
      response.status(500).send(err);
    }
  );
});

// request FIDO status
app.get("/sign_status/:id", (request, response) => {
  let user = getUserByDigestEmail(request.session.demail);
  scenarioPoll(request.params.id, user,
    function(res) {
      response.send(res);
    },
    function (err) {
      response.status(500).send(err);
    }
  );
});

// Sent signup email
app.post("/signup_code/:email", (request, response) => {
  try{ 
    let suCode = newSignup(request.params.email);
    let suHost = request.get('origin');
    let suUrl = suHost + "/signup#" + suCode;
    // Send mail
    mailer.sendMail({
      from: process.env.MAIL_FROM,
      to: request.params.email,
      subject: "Validate your IdCloud FIDO demo account",
      text: 'Click to validate your account: ' + suUrl
    })
    .then(() => {
      //console.log('Email sent')
      response.send("");
      //response.send('<a href="' + suUrl + '">Shortcut</a>');
    })
    .catch((error) => {
      console.error(`Error: ${error.message}`);
      response.status(500).send("Could not send email");
    });

  } catch (error) {
    console.error(`Error: ${error.message}`);
    response.status(400).send(error.message);
  }
});

function validateSignupCode(suCode) {
  let reg = db.get(SU_CODES + "." + suCode).value();
  let demail;
  if (reg) {
    db.unset(SU_CODES + "." + suCode)
      .write();
    if (!isExpired(reg.expires)) {
      demail = reg.demail;
    }
  }
  return demail;
}

function adminOp(method, path, user, onSuccess, onError) {

  if (!user) {
    onError("no user");
    return;
  }

  const options = {
    hostname: process.env.IDC_AAPI_HOST,
    port: 443,
    path: path,
    method: method,
    headers: {
      'x-api-key': process.env.IDC_SCS_APIKEY,
      'Authorization': 'Bearer ' + process.env.IDC_AAPI_JWT
    }
  };
  const req = https.request(options, res => {
    res.on('data', d => {
      console.log(`${method} ${path}: ${d}`);
      try {
        d = JSON.parse(d);
        if ((res.statusCode == 200) && (d.status == "ok")) {
          onSuccess(d);
        } else {
          onError(d.status);
        }
      } catch (err) {
        console.log(`${err}: ${d}`);
        onError(err);
      }
    });
  });
  req.on('error', error => {
    console.log(`${method} ${path} !ERROR!: ${error}`);
    onError(error);
  });
  req.end();
}

function enrollUser(user, request, response) {
  console.log(`Enroll user: ${user.id}`);
  request.session.demail = user.demail
  // Enroll_FIDO
  scenarioStart(process.env.IDC_SCS_ENROLL, user, undefined,
    function(res){
      // return FIDO registratin code and scenario id
      let result = {
        id: res.id,
        regCode: res.state.result.object.enrollmentToken
      };
      // send result
      response.send(JSON.stringify(result));
    },
    function(err){
      response.status(500).send(err);
    }
  );
}

app.post("/signup_validate/:suCode", (request, response) => {
  try {
    let demail = validateSignupCode(request.params.suCode);
    if (!demail) {
      response.status(404).send("Invalid signup code.");
      return;
    }

    function newUser() {
      console.log(`new user`);
      return {
        demail: demail,
        created: new Date().getTime(),
        id: uuidv4(),
      };
    }

    let user = getUserByDigestEmail(demail);
    if (user) {
      console.log("reset user: " + user.id);
      adminOp('DELETE', process.env.IDC_AAPI_PATH + "?username=" + user.id,
        user,
        function(res) {
          console.log("ok");
        }, function(err) {
          console.error("Failed to reset user: " + err);
        }
      );
    }
    enrollUser(newUser(), request, response);

  } catch (error) {
    console.error(`Error: ${error.message}`);
    response.status(500).send(error.message);
  }
});

app.get("/signup_status/:id", (request, response) => {
  let user = getUserByDigestEmail(request.session.demail);
  scenarioPoll(request.params.id, user,
    function(res) {
      response.send(res);
    },
    function (err) {
      response.status(500).send(err);
    }
  );
});

app.get("/authrs", (request, response) => {
  let user = getUserByDigestEmail(request.session.demail);
  adminOp('GET', process.env.IDC_AAPI_PATH + "?username=" + user.id,
    user,
    function(res) {
      response.send(res.authenticators);
    }, function(err) {
      console.error("Failed to list authenticators: " + err);
      response.status(500).send(err);
    }
  );
});

app.get("/delauthr/:id", (request, response) => {
  let user = getUserByDigestEmail(request.session.demail);
  adminOp('DELETE', process.env.IDC_AAPI_PATH  + "/" +
    request.params.id + "?username=" + user.id,
    user,
    function(res) {
      response.send(res.status);
    }, function(err) {
      console.error("Failed to delete authenticator: " + err);
      response.status(500).send(err);
    }
  );
});

app.get("/cleanup", (request, response) => {
  let usersNb = 0;
  let loginsDel = 0;
  let regsDel = 0;
  let suCodesNb = 0;
  let suCodesDel = 0;
  try {

    // Clean up users
    let userIds = db.get(USERS).keys().value();
    usersNb = userIds.length;
    console.log("Users Nb: " + usersNb);
    for (let i = usersNb-1; i >= 0; i--) {
      let uid = USERS + "." + userIds[i];
      let u = db.get(uid).value();
      // registration
      if (u.reg && isExpired(u.reg.expires)) {
        // delete
        db.unset(uid + ".reg").write();
        regsDel++;
      }
      // login
      if (u.login && isExpired(u.login.expires)) {
        // delete
        db.unset(uid + ".login").write();
        loginsDel++;
      }
    }

    // Clean up setup codes
    let suCodes = db.get(SU_CODES).keys().value();
    suCodesNb = suCodes.length;
    console.log("Setup Codes Nb: " + suCodesNb);
    for (let i = suCodesNb-1; i >= 0; i--) {
      let sucid = SU_CODES + "." + suCodes[i];
      let suc = db.get(sucid).value();
      if (suc.expires && isExpired(suc.expires)) {
        // delete
        db.unset(sucid).write();
        suCodesDel++;
      }
    }
    let res = {
      usersNb: usersNb,
      loginsDel: loginsDel,
      regsDel: regsDel,
      suCodesNb: suCodesNb,
      suCodesDel: suCodesDel
    }
    response.send(isAdmin(request) ? JSON.stringify(res) : "ok");
  } catch (error) {
    console.error(`Error: ${error.message}`);
    response.status(500).send(error.message);
  }
});

// listen for requests :)
const listener = app.listen(process.env.PORT, () => {
  console.log("App is listening on http://" + process.env.HOST + ":" + listener.address().port);
});

// HTTPS
if (process.env.HTTPS_KEY && process.env.HTTPS_PORT && process.env.HTTPS_CERT) {
  var privateKey  = fs.readFileSync(process.env.HTTPS_KEY, 'utf8');
  var certificate = fs.readFileSync(process.env.HTTPS_CERT, 'utf8');
  var credentials = {key: privateKey, cert: certificate};
  var httpsServer = https.createServer(credentials, app);
  const slistener = httpsServer.listen(process.env.HTTPS_PORT, () => {
    console.log("App is listening on https://" + process.env.HOST + ":" + slistener.address().port);
  });
}
