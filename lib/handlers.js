 /**
  * 
  * Request handlers
  * 
  */

 // Dependencies
 var _data = require('./data');
 var helpers = require('./helpers');

 // Define the handlers
 var handlers = {};

 // Users
 handlers.users = (data, callback) => {
    var acceptableMethods = ['post', 'get', 'put', 'delete'];
    if(acceptableMethods.indexOf(data.method) > -1){
        handlers._users[data.method](data, callback);
    } else{
        callback(405);
    }
 };

 // Container for the users submethods
 handlers._users = {};

 // Users - post
 // Required data: firstName, lastName, phone, password, tosAgreement
 handlers._users.post = (data, callback) => {
    // Check that all required fields are filled out
    var firstName = checkRequiredFields(data.payload.firstName);
    var lastName = checkRequiredFields(data.payload.lastName);
    var phone = checkRequiredFields(data.payload.phone, 10);
    var password = checkRequiredFields(data.payload.password);
    var tosAgreement = checkRequiredFields(data.payload.tosAgreement);

    if(firstName && lastName && phone && password && tosAgreement){
        // Make sure that the user doesn't already exist
        _data.read('users', phone, (err, data) => {
            if(err){
                // Hash the password
                var hashedPassword = helpers.hash(password);

                // Create the user object
                if(hashedPassword){
                    var userObject = {
                        firstName,
                        lastName,
                        phone,
                        hashedPassword,
                        'tosAgreement': true
                    };
    
                    // Store the user
                    _data.create('users', phone, userObject, (err) => {
                        if(!err){
                            callback(200)
                        }else{
                            console.log(err);
                            callback(500,{'Unprocessable Entity': 'Could not create the new user'});
                        }
                    });
                }else{
                    callback(500, {'Unprocessable Entity': 'Could not hash the user\'s password'});
                }
            } else{
                // User already exist
                callback(400, {'Bad Request': 'A user with that phone number already exists'});
            }
        });
    }else{
        callback(400, {'Bad Request': 'Missing Required fields'});
    }
 }

 // Users - get
 // Required data: phone
 // Optional data: none
 handlers._users.get = (data, callback) => {
    // Check that the phone number is valid
    var phone = checkRequiredFields(data.queryStringObject.phone, 10);
    if(phone){
        // Get the token from the headers
        var token = typeof(data.headers.token) == 'string' ? data.headers.token : false;
        // Verify that the given token is valid for the phone number
        handlers._tokens.verifyToken(token, phone, (tokenIsValid) => {
            if(tokenIsValid){
                _data.read('users',phone, (err, data) => {
                    if(!err && data){
                        //Remove the hashed password from the user object before returning it to the requester
                        delete data.hashedPassword;
                        callback(200,data);
                    }else{
                        callback(404);
                    }
                });
            }else{
                callback(403, {'Error': 'Missing required token in the header, or token is invalid'});
            }
        });
    }else{
        callback(400, {'Bad Request': 'Missing required field'});
    }
 }

 // Users - put
 // Required data: phone
 // Optional data: firstName, lastName, password (at least one must be specified)
 handlers._users.put = (data, callback) => {
    // Check the required field
    var phone = checkRequiredFields(data.payload.phone, 10);

    // Check the optional fields
    var firstName = checkRequiredFields(data.payload.firstName);
    var lastName = checkRequiredFields(data.payload.lastName);
    var password = checkRequiredFields(data.payload.password);

    // Error if the phone is invalid
    if(phone){
        // Error if nothing is sent to update
        if(firstName || lastName || password){
            // Get the token from the headers
            var token = typeof(data.headers.token) == 'string' ? data.headers.token : false;

            // Verify that the given token is valid for the phone number
            handlers._tokens.verifyToken(token, phone, (tokenIsValid) => {
                if(tokenIsValid){
                    // Lookup the user
                    _data.read('users',phone,(err, userData) => {
                        if(!err && userData){
                            // Update the fields necessary
                            userData.firstName = checkFieldsToUpdate(firstName, userData.firstName);
                            userData.lastName = checkFieldsToUpdate(lastName, userData.lastName);
                            userData.hashedPassword = checkFieldsToUpdate(helpers.hash(password), userData.hashedPassword);
                            
                            // Store the new updates
                            _data.update('users', phone, userData, (err) => {
                                if(!err){
                                    callback(200);
                                } else{
                                    console.log(err);
                                    callback(500, {'Unprocessable Entity': 'Could not update user'});
                                }
                            });
                        }else{
                            callback(400, {'Bad Request': 'The specified user does not exist'});
                        }
                    });
                } else{
                    callback(403, {'Error': 'Missing required token in the header, or token is invalid'});
                }
            });
        }else{
            callback(400,{'Bad Request': 'Missing fields to update'});
        }
    }else{
        callback(400, {'Bad Request': 'Missing required field'});
    }
 }

 // Users - delete
 // Required field: phone
 handlers._users.delete = (data, callback) => {
    // Check the phone number is valid
    var phone = checkRequiredFields(data.queryStringObject.phone, 10);
    if(phone){
        // Get the token from the headers
        var token = typeof(data.headers.token) == 'string' ? data.headers.token : false;

        // Verify that the given token is valid for the phone number
        handlers._tokens.verifyToken(token, phone, (tokenIsValid) => {
            if(tokenIsValid){
                // Lookup the user
                _data.read('users',phone, (err, data) => {
                    if(!err && data){
                        _data.delete('users', phone, (err) => {
                            if(!err){
                                callback(200);
                            }else{
                                callback(500, {'Unprocessable Entity': 'Could not delete the specified user'});
                            }
                        });
                    }else{
                        callback(400, {'Bad Request': 'Could not find the specified user'});
                    }
                });
            }else{
                callback(403, {'Error': 'Missing required token in the header, or token is invalid'});
            }
        });
    }else{
        callback(400, {'Bad Request': 'Missing required field'});
    }
 }

 // Tokens
 handlers.tokens = (data, callback) => {
    var acceptableMethods = ['post', 'get', 'put', 'delete'];
    if(acceptableMethods.indexOf(data.method) > -1){
        handlers._tokens[data.method](data, callback);
    } else{
        callback(405);
    }
 };

 // Container for all the tokens methods
 handlers._tokens = {};

 // Tokens - post
 // Required data: phone, password
 // Optional data: none
 handlers._tokens.post = (data, callback) => {
    var phone = checkRequiredFields(data.payload.phone, 10);
    var password = checkRequiredFields(data.payload.password);
    if(phone && password){
        // Lookup the user who macthes that phone number
        _data.read('users', phone, (err, userData) => {
            if(!err && userData){
                // Hash the sent password, and compare it to the password stored in the user object
                var hashedPassword = helpers.hash(password);
                if(hashedPassword == userData.hashedPassword){
                    // If valid, create a new token with a randmon name. Set expiration date 1 hour in the future
                    var tokenId = helpers.createRandomString(20);
                    var expires = Date.now() + 1000 * 60 * 60;
                    var tokenObject = {
                        phone,
                        'id': tokenId,
                        expires
                    };

                    // Stores the token
                    _data.create('tokens', tokenId, tokenObject, (err)=> {
                        if(!err){
                            callback(200, tokenObject);
                        }else{
                            console.log(err);
                            callback(500, {'Unprocessable Entity': 'Could not create the new token'});
                        }
                    });
                }else{
                    callback(400,{'Bad Request': 'Password did not match the specified user\'s stored password'});
                }
            }else{
                callback(400,{'Bad Request': 'Could not find the specified user'});
            }
        });
    }else{
        callback(400, {'Bad Request': 'Missing Required fields'});
    }
 }

 // Tokens - get
 // Required data: id
 // Optional data: none
 handlers._tokens.get = (data, callback) => {
    // Check that the id is valid
    var id = checkRequiredFields(data.queryStringObject.id, 20);
    if(id){
        // Lookup the token
        _data.read('tokens',id, (err, tokenData) => {
            if(!err && tokenData){
                callback(200,tokenData);
            }else{
                callback(404);
            }
        });
    }else{
        callback(400, {'Bad Request': 'Missing required field'});
    }
 }

 // Tokens - put
 // Required data: id, extend
 // Optional data: none
 handlers._tokens.put = (data, callback) => {
    var id = checkRequiredFields(data.payload.id, 20);
    var extend = checkRequiredFields(data.payload.extend);
    if(id && extend){
        // Lookup the tken
        _data.read('tokens', id, (err, tokenData) => {
            if(!err && tokenData){
                // Check to make sure the token isn't already expired
                if(tokenData.expires > Date.now()){
                    // Set the expiration an hour from now
                    tokenData.expires = Date.now() + 1000 * 60 * 60;

                    // Store the new updates
                    _data.update('tokens', id, tokenData, (err) => {
                        if(!err){
                            callback(200);
                        }else{
                            callback(500, {'Unprocessable Entity': 'Could not update the token\'s expiration'});
                        }
                    })
                }else{
                    callback(400, {'Bad Request': 'The token has already expired, and cannot be extended'});
                }
            }else{
                callback(400, {'Bad Request': 'Specified token does not exist'});
            }
        });
    }else{
        callback(400, {'Bad Request': 'Missing required field(s) or fields are invalid'});
    }
 }

 // Tokens - delete
 // Required data: id
 // Optional data: none
 handlers._tokens.delete = (data, callback) => {
    // Check the id is valid
    var id = checkRequiredFields(data.queryStringObject.id, 20);
    if(id){
        // Lookup the token
        _data.read('tokens',id, (err, data) => {
            if(!err && data){
                _data.delete('tokens', id, (err) => {
                    if(!err){
                        callback(200);
                    }else{
                        callback(500, {'Unprocessable Entity': 'Could not delete the specified token'});
                    }
                });
            }else{
                callback(400, {'Bad Request': 'Could not find the specified token'});
            }
        });
    }else{
        callback(400, {'Bad Request': 'Missing required field'});
    }
 }

 // Verify if the given token id is currently valid for a given user
 handlers._tokens.verifyToken = (id, phone, callback) => {
     // Lookup the token
     _data.read('tokens', id, (err, tokenData) => {
         if(!err && tokenData){
            // Check that the token is for the given user and has not expired
            if(tokenData.phone == phone && tokenData.expires > Date.now()){
                callback(true);
            }else{
                callback(false);
            }
         }else{
            callback(false);
         }
     });
 }


 // Ping handler
 handlers.ping = (data, callback) => {
    // callback(406, {'name': 'Sample Handler'});
    callback(200)
 }

 // Not found handler
 handlers.notFound = (data, callback) => {
    callback(404);
 };

 var checkRequiredFields = (field, length) => {
    let requiredField;
    switch(typeof(field)){
        case 'string':
            if(length){
                requiredField = field.trim().length == length ? field.trim() : false;
            }else{
                requiredField = field.trim().length > 0 ? field.trim() : false;
            }
            break;
        case 'boolean':
            requiredField = field ? field : false;
    }
    return requiredField;
 }

 var checkFieldsToUpdate = (newVal, userFieldData) => (newVal ? newVal : userFieldData);



 // Export the module
 module.exports = handlers;