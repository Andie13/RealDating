
$(function() {

  let step = 1;
  let signId;

  function pollSignResponse() {
    $.get("/sign_status/" + signId)
      .done(function(res) {
        if (res == "Success") {
          statEvent('sign res', "success", undefined, countdown);
          $("#out").html(
            '<img src="' + SUCCESS_IMG + '"/>' +
              "<p>Signature validated</p>"
          );
          cancelCountdown();
          gotoStep4();
        }
      })
      .fail(function(err) {
        statEvent('error', 'sign res', err.responseText);
        $("#out").html(
          '<img src="' + ERROR_IMG + '"/>' +
            '<p class="error">Request failed: ' + err.responseText + '<br/><a href="/">Retry</a></p>'
        );
        cancelCountdown();
        gotoStep4();
      });
  }

  function gotoStep(n) {
    if (n > 1) {
      $("div.multi-form-steps > ul > li:nth-child("+(n-2)+")").removeClass("previous-active");
    }
    let prev = $("div.multi-form-steps > ul > li:nth-child("+(n-1)+")");
    let active = $("div.multi-form-steps > ul > li:nth-child("+n+")");
    prev.removeClass("active");
    prev.addClass("previous-active");
    active.addClass("active");
    switch (n) {
      case 2:
        $("#step-desc").text("Step 2: Verify transfer details and click Next.");
        break;
      case 3:
        $("#step-desc").text("Step 3: Sign transfer on your mobile.");
        $("#buttons button.next").hide();
        $("#buttons").addClass("centered");
        break;
      case 4:
        $("#step-desc").text("Step 4: Your request has been processed.");
        $("#buttons button.next").hide();
        $("#buttons button.cancel").hide();
        break;
      default:
        break;
    }
  }

  $("#buttons button.cancel").click(function() {
    if (step == 2) {
      location.reload();
    } else {
      location = "/account";
    }
  });

  function gotoStep4() {
    while (step < 4) {
      gotoStep(++step);
    }
  }

  $("#transfer-form form").submit(function(event) {
    event.preventDefault();
    if (step == 1) {
      $("#from-v").text($("#from-select").val());
      $("#to-v").text($("#to-select").val());
      $("#amount-v").text(parseFloat($("#amount-input").val()));
      $("#transfer-form table").addClass("review");
    } else if (step == 2) {
      $("#transfer-form").hide();
      $("#transfer-sign").show();
      let transactionData = [
        { "operation": "signature" },
        { "from": $("#from-v").text() },
        { "to": $("#to-v").text() },
        { "amount": $("#amount-v").text() },
      ];
      $.post({
        url:"/sign",
        data: JSON.stringify(transactionData),
        contentType:"application/json; charset=utf-8",
      })
      .done(function(res) {
        statEvent('sign', "success");
        $("#transfer-sign #out img").attr("src", WAITING_IMG);
        let polltml = initCountdownAndGetHtml({
          opname: "Signature request",
          evtname: "sign res",
          fpoll: pollSignResponse,
          fexpire: gotoStep4
        });
        $("#transfer-sign #out").append(polltml);
        $("button.next").focus();
        window.scrollBy(0,300);
        signId = res;
      })
      .fail(function(err) {
        statEvent('error', 'sign', err.responseText);
        $("#out").html(
          '<img src="' + ERROR_IMG + '"/>' +
          '<p class="error">Signature failed: ' + err.responseText +
          '<br/><a href="' + location.pathname + '">Retry</a></p>'
        );
        window.scrollBy(0,300);
        gotoStep(++step);
      });
    }
    gotoStep(++step);
  });

});