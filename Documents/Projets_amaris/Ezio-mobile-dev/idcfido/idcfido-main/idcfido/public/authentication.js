
$(function() {

  function error(err) {
    $("div.error").text(err ? err : "");
  }

  function deleteAuthenticator(credId) {
    if (!confirm("Delete authenticator?")) {
      return;
    }
    $.get("/delauthr/" + credId, {})
      .done(function(res) {
        if (res == "ok") {
          listAuthenticators();
        } else {
          error("Failed to delete authenticator: " + err);
        }
      })
      .fail(function(err) {
        error("Failed to delete authenticator: " + err.statusText);
      });
  }

  function listAuthenticators() {
    $.get("/authrs")
      .done(function(res) {

        let html = `<li class="table-header">`;
        html += `<div class="col col-1">Name</div>`
        html += `<div class="col col-2">AAGUID</div>`
        html += `<div class="col col-3">Created</div>`
        html += `<div class="col col-4">Last used</div>`
        //html += `<div class="col col-5">Counter</div>`
        html += `<div class="col col-5">Delete</div>`
        html += "</li>";
        $("ul.responsive-table").html(html);

        /*
          aaguid: "66a0ccb3-bd6a-191f-ee06-e375c50b9846"
          coseAlgoId: -7
          createdDateTime: "2020-11-25T12:34:51.547Z"
          credentialId: "-gsYfMK2Dy8XWy1EWocBNA"
          friendlyName: "Biometric Authenticator"
          lastSuccessAuthnDateTime: "2020-11-25T13:03:36.781Z"
          lastUsedAuthnDateTime: "2020-11-25T13:03:36.768Z"
          rpId: "tls-idc-fido2.glitch.me"
          signatureCounter: 4
        */
        res.forEach(elt => {
          html = `<li class="table-row">`;
          html += `<div class="col col-1" data-label="Name">${elt.friendlyName}</div>`
          html += `<div class="col col-2" data-label="AAGUID">${elt.aaguid}</div>`
          html += `<div class="col col-3" data-label="Created">${elt.createdDateTime.substring(0,10)}</div>`
          html += `<div class="col col-4" data-label="Last used">${elt.lastUsedAuthnDateTime ? elt.lastUsedAuthnDateTime.substring(0,10) : 'never'}</div>`
          //html += `<div class="col col-5" data-label="Counter">${elt.signatureCounter}</div>`
          html += `<div class="col col-5" data-label="Delete"><a href="#${elt.credentialId}" class="delauthr">&#10060;</a></div>`
          html += "</li>";
          $("ul.responsive-table").append(html);
        });

        $("a.delauthr").click( function(event) {
          deleteAuthenticator(event.target.href.substring(event.target.href.indexOf("#")+1));
          return false;
        });

      })
      .fail(function(err) {
        error("Failed to list authenticators: " + err.statusText);
      });
  }

  listAuthenticators();
});
