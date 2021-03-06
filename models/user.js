var crypto = require('crypto');
var async = require('async');
var util = require('util');
var lastMod = require('./lastMod');

var mongoose = require('../libs/mongoose'),
    Schema = mongoose.Schema;

var schema = new Schema({
    email: {
        type: String,
        unique: true,
        required: true
    },
    hashedPassword: {
        type: String,
        required: true
    },
    salt: {
        type: String,
        required: true
    },
    created: {
        type: Date,
        default: Date.now
    },
	activationKey: {
		type: String,
		required: true
	},
	isEmailConfirmed: {
		type: Boolean,
		required: true,
		default: false
	}

});

schema.plugin(lastMod);

schema.methods.encryptPassword = function (password) {
    return crypto.createHmac('sha1', this.salt).update(password).digest('hex');
};

schema.virtual('password')
    .set(function (password) {
        this._plainPassword = password;
        this.salt = Math.random() + '';
        this.hashedPassword = this.encryptPassword(password);
    })
    .get(function () {
        return this._plainPassword;
    });


schema.methods.checkPassword = function (password) {
    return this.encryptPassword(password) === this.hashedPassword;
};

schema.statics.authorize = function (email, password, callback) {
    var User = this;

    async.waterfall([
        function (callback) {
            User.findOne({email: email}, callback);
        },
        function (user, callback) {
            if (user) {
                if (user.checkPassword(password)) {
                    callback(null, user);
                } else {
                    callback(new AuthError("Пароль неверен"));
                }
            }
            else {
				callback(new AuthError("Пользователь с email " + email + " не найден"));
                /* var user = new User({email: email, password: password});
                user.save(function (err) {
                    if (err) return callback(err);

                    callback(null, user);
                }); */
            }
        }
    ], callback);
};

var HttpError = require('../error').HttpError;

schema.statics.register = function (email, password, callback) {
	var User = this;
	async.waterfall([
        function (callback) {
            User.findOne({email: email}, callback);
        },
        function (user, callback) {
            if (user) {
                callback(new HttpError(403, "Пользователь с таким Email уже зарегистрирован. Попробуйте вспомнить пароль или восстановите доступ"));
            }
            else {
                var user = new User({
					email: email, 
					password: password,
					activationKey : crypto.randomBytes(32).toString('hex')
					});

                user.save(function (err) {
                    if (err) return callback(err);

                    callback(null, user);
                });
            }
        }
    ], callback);
};

exports.User = mongoose.model('User', schema);


function AuthError(message) {
    Error.apply(this, arguments);
    Error.captureStackTrace(this, AuthError);

    this.message = message;
}

util.inherits(AuthError, Error);

AuthError.prototype.name = 'AuthError';

exports.AuthError = AuthError;


