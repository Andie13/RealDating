
$(function() {

  let loginId;

  function pollStatus() {
    $.get("/login_status/" + loginId)
      .done(function(res) {
        if (res == "Success") {
          statEvent('login res', "success", undefined, countdown);
          $("#out").html(
            '<img src="' + SUCCESS_IMG + '"/>' +
              "<p>FIDO authentication success!!</p>"
          );
          cancelCountdown();
          setTimeout(function() {
            window.location = "/account";
          }, 1000);
        }
      })
      .fail(function(err) {
        statEvent('error', 'login res', err.responseText);
        $("#out").html(
          '<img src="' + ERROR_IMG + '"/>' +
            '<p class="error">Request failed: ' + err.responseText + '<br/><a href="/">Retry</a></p>'
        );
        cancelCountdown();
      });
  }

  function doLogin(email) {
    statEvent('login');
    let url = config.uitest ? "/test-ok/" : "/login/";
    $.post(url + email)
      .done(function(res) {
        loginId = res;
        let html = '<img src="' + WAITING_IMG + '"/>' +
          "<p>Complete authentication on your registered mobile.</p>";
        html += initCountdownAndGetHtml({
          opname: "Authentication",
          evtname: "login res",
          fpoll: pollStatus
        });
        $("#out").html(html);
      })
      .fail(function(err) {
        statEvent('error', 'login', err.responseText);
        $("#out").html(
          '<img src="' + ERROR_IMG + '"/>' +
            '<p class="error">Login failed: ' + err.responseText + '<br/><a href="/">Retry</a></p>'
        );
      });
  }

  function doSignup(email) {
    statEvent('signup');
    $.post("/signup_code/" + email)
      .done(function(res) {
        $("#out").html(
          '<img src="' + EMAIL_IMG + '"/>' +
            "<p>Check your inbox! We sent a email to validate account creation.<br>You can close this window. </p>"
        );
        if (res) {
          $("#out p").append(res);
        }
      })
      .fail(function(err) {
        statEvent('error', 'signup', err.responseText);
        $("#out").html(
          '<img src="' + ERROR_IMG + '"/>' +
            '<p class="error">Request failed: ' + err.responseText + '<br/><a href="/">Retry</a></p>'
        );
        $("#signupbut").prop("disabled", false);
      });
  }

  $("form").submit(function(event) {
    $("#formdiv").hide();
    $("#out").html(
      '<img src="' + WAITING_IMG + '"/>' +
        "<p>Sending request...</p>"
    );
    event.preventDefault();
    let email = encodeURIComponent($("input#email").val().trim().toLowerCase());
    let clicked = $(this).find("button[clicked=true]");
    if (clicked.attr("id") == "signupbut") {
      doSignup(email);
    } else {
      doLogin(email);
    }
    $("button").removeAttr("clicked");
  });

  $("button").click(function() {
    $(this).attr("clicked", "true");
  });

  $(".toggle").click(function(event) {
    $("#out").html("");
    let signup = event.target.id.endsWith("signup");
    $(".signup").toggle(signup);
    $(".login").toggle(!signup);
    return false;
  });

  if (config.noAutocomplete) {
    $("intput#email").attr("autocomplete", "off");
  }
});
