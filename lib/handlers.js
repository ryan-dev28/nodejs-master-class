 /**
  * 
  * Request handlers
  * 
  */

const { type } = require("os");
const { Z_DATA_ERROR } = require("zlib");

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
 // @TODO Only let an authenticated user access their object. Don't let them access anyone else's
 handlers._users.get = (data, callback) => {
    // Check that the phone number is valid
    var phone = checkRequiredFields(data.queryStringObject.phone, 10);
    if(phone){
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
        callback(400, {'Bad Request': 'Missing required field'});
    }
 }

 // Users - put
 // Required data: phone
 // Optional data: firstName, lastName, password (at least one must be specified)
 // @TODO Only let an authenticated user update their own object. Don't let them update anyone else's
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
                        }else{
                            console.log(err);
                            callback(500, {'Unprocessable Entity': 'Could not update user'});
                        }
                    });
                }else{
                    callback(400, {'Bad Request': 'The specified user does not exist'});
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
 // @TODO Only let an authenticated user delete their object. Don't let them delete anyone else
 // @TODO Cleanup (delete) any other data files associated with the user
 handlers._users.delete = (data, callback) => {
    // Check the phone number is valid
    var phone = checkRequiredFields(data.queryStringObject.phone, 10);
    if(phone){
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
        callback(400, {'Bad Request': 'Missing required field'});
    }
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