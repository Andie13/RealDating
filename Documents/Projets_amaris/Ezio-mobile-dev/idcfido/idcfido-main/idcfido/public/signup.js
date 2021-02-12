
let regId;

function show(what) {
  $(".qrc").toggle(what == "qrc");
  $(".mob").toggle(what == "mob");
  return false;
}
function showRegCode(regCode) {
  let html =
    '<div>&#x2713; Your e-Mail is now verified!</div>' +
    '<img class="qrc" src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=' + regCode + '"/>' +
    '<p class="qrc">Scan the QR code with your FIDO app to complete registration.</p>';
  if (config.mobLink) {
    let reglink = config.mobLink.replace("*REGCODE*", regCode);
    html +=
      '<p class="qrc"><a href="#" onclick="return show(\'mob\')">You\'re on mobile?</a></p>' +
      '<p class="mob">Proceed with FIDO app:<br/><button onclick="window.location=\'' + reglink + '\'">Register</button></p>' +
      '<p class="mob"><a href="#" onclick="return show(\'qrc\')">You are not on your mobile?</a></p>';
  }
  html += initCountdownAndGetHtml({
            opname: "Registration",
            evtname: "signup res",
            fpoll: pollStatus,
            //fexpire: ,
            retrypath: "/"
          });
  $("#out").html(html);
}


function pollStatus() {
  $.get("/signup_status/" + regId)
    .done(function(res) {
      if (res == "Success") {
        statEvent('signup res', "success", undefined, countdown);
        cancelCountdown();
        $("#out").html(
          '<img src="' + SUCCESS_IMG + '"/>' +
          '<p>FIDO registration successfully completed.<br/>' +
          'Redirecting to <a href="/">Login page</a>...</p>'
        );
        setTimeout(function() {
          window.location = "/account";
        }, 3000);
      }
    })
    .fail(function(err) {
      statEvent('error', 'signup res', err.responseText);
      $("#out").html(
        '<img src="' + ERROR_IMG + '"/>' +
        '<p class="error">Request failed: ' + err.responseText +
        '<br/><a href="/">Retry</a></p>'
      );
      cancelCountdown();
    });
}

function doRegister(suCode) {
  $.post("/signup_validate/" + suCode)
    .done(function(res) {
      statEvent('signup sucode', "success", undefined, countdown);
      res = JSON.parse(res);
      regId = res.id;
      showRegCode(res.regCode);
    })
    .fail(function(err) {
      statEvent('error', 'signup sucode', err.responseText);
      $("#out").html(
        '<img src="' + ERROR_IMG + '"/>' +
        '<p class="error">Registration failed: ' + err.responseText +
        '<br/><a href="/">Retry</a></p>'
      );
    });
}

$(function() {

  let suCode = window.location.hash;
  if (suCode) {
    $("#out").html(
      '<img src="' + WAITING_IMG + '"/>' +
      '<p>Loading...</p>'
    );
    doRegister(suCode.substring(1));
  } else {
    $("#out").html(
      '<p>Wait for the confirmation mail to complete registration.</p>'
    );
    if (config.uitest) showRegCode("lkjs-98732-047987-93729879");
  }

});
