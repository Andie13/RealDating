# IdCloud FIDO authentication demo

A basic demo to show a paswordless registration and authentication flow

## Setup

* Execute `npm ci` 

## Execution

1. Create `.env` file based on `.env.template` file, defining the appropriate configuration

2. Execute `npm start`

## Backend API

Here are the list of entry points:

### HTML Pages

Path | Description 
---- | -----------
/           | Home/Login page 
/signup     | Home/Signup page 
/privacy    | Privacy notice page 
/account    | Account summary page 
/transfer   | Money transfer page 
/authentication | List of authenticators page 
/logout | logout page (redirect)
/session | dummy session page (redirect)


### AJAX API

Path                | Description 
-----------------   | -----------
/signup_code/:email      | Sends registration mail with signup code (sucode) to specified email. Creates user in DB if needed (with hashed email), and stores sucode.
/signup_validate/:suCode | Validates specified signup code, and create enrollment scenario in IdCloud. Returns a JSON object with the IdCloud scenario ID and enrollment token to be displayed as QR code.
/signup_status/:id       | Request status for FIDO enrollment for the specified scenario ID, returns the IdCloud JSON response.
/login/:email     | Requests FIDO authentication for the specified email, returns the IdCloud scenario ID
/login_status/:id | Requests status for FIDO authentication for the specified scenario ID, returns the IdCloud JSON response
/sign             | Requests FIDO signature for the currently logged in user, returns the IdCloud scenario ID
/authrs          | Requests the list of registered FIDO authenticators for the currently logged in user, returns the IdCloud JSON response
/delauthr/:id    | Delete the specified authenticator of the currently logged in user, returns the IdCloud  response status
/cleanup | Removes expired signup/authentication/signature requests from DB. If user is logged and admin, the detailed numbers are returned in JSON response

### Ajax status codes

Ajax API uses the following status code:
* 200: Request successfully processed
* 400: Malformed/invalid request
* 404: Targeted asset (user/scenario/authenticator) not found
* 500: Internal error

