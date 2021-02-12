const ERROR_IMG = "/img/error.png"
const WAITING_IMG = "/img/waiting.png"
const SUCCESS_IMG = "/img/success.png"
const EMAIL_IMG = "/img/email.png"

// CONFIGURATION

const DEFAULT_CONFIG = {
  "version": "2",
  "debug": false,
  "stats": true,
  "noAutocomplete": false,
  "uitest": false,
  "countdown": "graphic",
  "mobLink": ""
// "mobLink": "https://fido.app/register?reg=*REGCODE*"
}
let config;
function setDefaultConfig() {
  config = DEFAULT_CONFIG;
  localStorage.setItem( "idcf_config", JSON.stringify(config));
}
try {
  config = localStorage.getItem( "idcf_config");
  if (config) {
    config = JSON.parse(config);
  }
  if (!config || (config.version != DEFAULT_CONFIG.version)) {
    setDefaultConfig();
  }

  // analytics config
  if (config.stats === true) {
    let gatag = $("meta[name=gatag]").attr("content");
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', gatag);
    gtag('set', 'allow_google_signals', false);
  }

} catch {
  setDefaultConfig();
}

// PRIVACY NOTICE
function checkConsentCookies() {
  try {
    var now = new Date();
    var EXPIRATION = Math.round(1000*60*60*24*30.5*18); // 18 months in ms
    let cookieInfo = Cookies.get('cookieInfo');
    if (!cookieInfo) {
      $('body').prepend("\
      <div id='cookies-banner' style='display: none;'>\
        <button id='cookies-accept'>Got it!</button>\
        <div>This website uses cookies to enhance your user experience\
        <a href='/privacy.html' id='cookies-more'>Read more</a></div>\
      </div>");
      $("#cookies-banner").show();
      $("#cookies-accept").click(function() {
        Cookies.set('cookieInfo', 'true', { expires: 365 });
        $("#cookies-banner").hide();
      });
    }
  } catch (err) {
    console.error(err);
  }
}
setTimeout(checkConsentCookies, 2000);

// USAGE STATS
function statEvent(name, status, message, stat) {
  if (config.nostats) {
    return;
  }
  gtag && gtag('event', name, {
    "status": status,
    "message": message,
    "stat": stat
  });
}

// TIMEOUT COUNTDOWN
let poller;
let countdown;
const EXPIRATION = 120; // seconds
const POLL_EVERY = 3; // seconds
let textualCountdown = config.countdown == "txt";
let graphicalCountdown = !textualCountdown;


function initCountdownAndGetHtml(params) {
  let html = "";
  if (textualCountdown) {
    html += '<p>Expires in <span id="countdown">...</span></p>';
  }
  if (graphicalCountdown) {
    html += '<div class="progress"><div></div></div>';
  }
  poller = Object.assign({}, params);
  poller.timer = setInterval(updateCountdownAndReturn, 1000);
  countdown = EXPIRATION;
  return html;
}

function cancelCountdown() {
  if (poller) {
    clearInterval(poller.timer);
    poller = undefined;
  }
}

function updateCountdownAndReturn() {
  if (countdown <= 0) {
    statEvent(poller.evtname, 'timeout', undefined);
    $("#out").html(
      '<img src="' + ERROR_IMG + '"/>' +
      '<p class="error">' + poller.opname + ' expired.<br/><a href='
       + (poller.retrypath || location.pathname) + '>Retry</a></p>'
    );
    let fexpire = poller.fexpire;
    cancelCountdown();
    if (fexpire) {
      fexpire();
    }
    return;
  }
  if (textualCountdown) {
    $("#countdown").html(Math.max(0, countdown) + "s");
  }
  if (graphicalCountdown) {
    let pct = Math.round((countdown / EXPIRATION) * 100);
    $("div.progress div").css("width", pct + "%");
    if (pct < 25) {
      $("div.progress div").css("background-color", "red");
    }
  }
  countdown--;
  if ((countdown % POLL_EVERY)==0 && // only poll every X secondes
    (!config.uitest)) {
    poller.fpoll();
  }
}

$(".user").click(function(event){
  // toggle between email and user id
  let u = $(".user");
  let tmp = u.attr("title");
  u.attr("title", u.text());
  u.text(tmp);
});

function noTranslate(selector) {
  // default selector
  let target = selector ? $(selector) : $(".material-icons");
  target.addClass("notranslate");
  target.attr("translate", "no");
}
noTranslate();
