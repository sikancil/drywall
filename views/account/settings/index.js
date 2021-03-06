'use strict';

var renderSettings = function(req, res, next, oauthMessage) {
  var outcome = {};
  
  var getAccountData = function(callback) {
    req.app.db.models.Account.findById(req.user.roles.account.id, 'name company phone zip').exec(function(err, account) {
      if (err) {
        return callback(err, null);
      }
      
      outcome.account = account;
      callback(null, 'done');
    });
  };
  
  var getUserData = function(callback) {
    req.app.db.models.User.findById(req.user.id, 'username email twitter.id github.id facebook.id').exec(function(err, user) {
      if (err) {
        callback(err, null);
      }
      
      outcome.user = user;
      return callback(null, 'done');
    });
  };
  
  var asyncFinally = function(err, results) {
    if (err) {
      return next(err);
    }
    
    res.render('account/settings/index', {
      data: {
        account: JSON.stringify(outcome.account),
        user: JSON.stringify(outcome.user)
      },
      oauthMessage: oauthMessage,
      oauthTwitter: !!req.app.get('twitter-oauth-key'),
      oauthTwitterActive: outcome.user.twitter ? !!outcome.user.twitter.id : false,
      oauthGitHub: !!req.app.get('github-oauth-key'),
      oauthGitHubActive: outcome.user.github ? !!outcome.user.github.id : false,
      oauthFacebook: !!req.app.get('facebook-oauth-key'),
      oauthFacebookActive: outcome.user.facebook ? !!outcome.user.facebook.id : false
    });
  };
  
  require('async').parallel([getAccountData, getUserData], asyncFinally);
};

exports.init = function(req, res, next){
  renderSettings(req, res, next, '');
};

exports.connectTwitter = function(req, res, next){
  req._passport.instance.authenticate('twitter', function(err, user, info) {
    if (!info || !info.profile) {
      return res.redirect('/account/settings/');
    }
    
    req.app.db.models.User.findOne({ 'twitter.id': info.profile.id, _id: { $ne: req.user.id } }, function(err, user) {
      if (err) {
        return next(err);
      }
      
      if (user) {
        renderSettings(req, res, next, 'Another user has already connected with that Twitter account.');
      }
      else {
        req.app.db.models.User.findByIdAndUpdate(req.user.id, { twitter: info.profile._json }, function(err, user) {
          if (err) {
            return next(err);
          }
          
          res.redirect('/account/settings/');
        });
      }
    });
  })(req, res, next);
};

exports.connectGitHub = function(req, res, next){
  req._passport.instance.authenticate('github', function(err, user, info) {
    if (!info || !info.profile) {
      return res.redirect('/account/settings/');
    }
    
    req.app.db.models.User.findOne({ 'github.id': info.profile.id, _id: { $ne: req.user.id } }, function(err, user) {
      if (err) {
        return next(err);
      }
      
      if (user) {
        renderSettings(req, res, next, 'Another user has already connected with that GitHub account.');
      }
      else {
        req.app.db.models.User.findByIdAndUpdate(req.user.id, { github: info.profile._json }, function(err, user) {
          if (err) {
            return next(err);
          }
          
          res.redirect('/account/settings/');
        });
      }
    });
  })(req, res, next);
};

exports.connectFacebook = function(req, res, next){
  req._passport.instance.authenticate('facebook', { callbackURL: '/account/settings/facebook/callback/' }, function(err, user, info) {
    if (!info || !info.profile) {
      return res.redirect('/account/settings/');
    }
    
    req.app.db.models.User.findOne({ 'facebook.id': info.profile.id, _id: { $ne: req.user.id } }, function(err, user) {
      if (err) {
        return next(err);
      }
      
      if (user) {
        renderSettings(req, res, next, 'Another user has already connected with that Facebook account.');
      }
      else {
        req.app.db.models.User.findByIdAndUpdate(req.user.id, { facebook: info.profile._json }, function(err, user) {
          if (err) {
            return next(err);
          }
          
          res.redirect('/account/settings/');
        });
      }
    });
  })(req, res, next);
};

exports.disconnectTwitter = function(req, res, next){
  req.app.db.models.User.findByIdAndUpdate(req.user.id, { twitter: { id: undefined } }, function(err, user) {
    if (err) {
      return next(err);
    }
    
    res.redirect('/account/settings/');
  });
};

exports.disconnectGitHub = function(req, res, next){
  req.app.db.models.User.findByIdAndUpdate(req.user.id, { github: { id: undefined } }, function(err, user) {
    if (err) {
      return next(err);
    }
    
    res.redirect('/account/settings/');
  });
};

exports.disconnectFacebook = function(req, res, next){
  req.app.db.models.User.findByIdAndUpdate(req.user.id, { facebook: { id: undefined } }, function(err, user) {
    if (err) {
      return next(err);
    }
    
    res.redirect('/account/settings/');
  });
};

exports.update = function(req, res, next){
  var workflow = new req.app.utility.Workflow(req, res);
  
  workflow.on('validate', function() {
    if (!req.body.first) {
      workflow.outcome.errfor.first = 'required';
    }
    
    if (!req.body.last) {
      workflow.outcome.errfor.last = 'required';
    }
    
    if (workflow.hasErrors()) {
      return workflow.emit('response');
    }
    
    workflow.emit('patchAccount');
  });
  
  workflow.on('patchAccount', function() {
    var fieldsToSet = {
      name: {
        first: req.body.first,
        middle: req.body.middle,
        last: req.body.last,
        full: req.body.first +' '+ req.body.last
      },
      company: req.body.company,
      phone: req.body.phone,
      zip: req.body.zip,
      search: [
        req.body.first,
        req.body.middle,
        req.body.last,
        req.body.company,
        req.body.phone,
        req.body.zip
      ]
    };
    
    req.app.db.models.Account.findByIdAndUpdate(req.user.roles.account.id, fieldsToSet, function(err, account) {
      if (err) {
        return workflow.emit('exception', err);
      }
      
      workflow.outcome.account = account;
      return workflow.emit('response');
    });
  });
  
  workflow.emit('validate');
};

exports.identity = function(req, res, next){
  var workflow = new req.app.utility.Workflow(req, res);
  
  workflow.on('validate', function() {
    if (!req.body.username) {
      workflow.outcome.errfor.username = 'required';
    }
    else if (!/^[a-zA-Z0-9\-\_]+$/.test(req.body.username)) {
      workflow.outcome.errfor.username = 'only use letters, numbers, \'-\', \'_\'';
    }
    
    if (!req.body.email) {
      workflow.outcome.errfor.email = 'required';
    }
    else if (!/^[a-zA-Z0-9\-\_\.\+]+@[a-zA-Z0-9\-\_\.]+\.[a-zA-Z0-9\-\_]+$/.test(req.body.email)) {
      workflow.outcome.errfor.email = 'invalid email format';
    }
    
    if (workflow.hasErrors()) {
      return workflow.emit('response');
    }
    
    workflow.emit('duplicateUsernameCheck');
  });
  
  workflow.on('duplicateUsernameCheck', function() {
    req.app.db.models.User.findOne({ username: req.body.username, _id: { $ne: req.user.id } }, function(err, user) {
      if (err) {
        return workflow.emit('exception', err);
      }
      
      if (user) {
        workflow.outcome.errfor.username = 'username already taken';
        return workflow.emit('response');
      }
      
      workflow.emit('duplicateEmailCheck');
    });
  });
  
  workflow.on('duplicateEmailCheck', function() {
    req.app.db.models.User.findOne({ email: req.body.email, _id: { $ne: req.user.id } }, function(err, user) {
      if (err) {
        return workflow.emit('exception', err);
      }
      
      if (user) {
        workflow.outcome.errfor.email = 'email already taken';
        return workflow.emit('response');
      }
      
      workflow.emit('patchUser');
    });
  });
  
  workflow.on('patchUser', function() {
    var fieldsToSet = {
      username: req.body.username,
      email: req.body.email,
      search: [
        req.body.username,
        req.body.email
      ]
    };
    
    req.app.db.models.User.findByIdAndUpdate(req.user.id, fieldsToSet, function(err, user) {
      if (err) {
        return workflow.emit('exception', err);
      }
      
      user.populate('roles.admin roles.account', 'name.full', function(err, user) {
        if (err) {
          return workflow.emit('exception', err);
        }
        
        workflow.outcome.user = user;
        workflow.emit('response');
      });
    });
  });
  
  workflow.emit('validate');
};

exports.password = function(req, res, next){
  var workflow = new req.app.utility.Workflow(req, res);
  
  workflow.on('validate', function() {
    if (!req.body.newPassword) {
      workflow.outcome.errfor.newPassword = 'required';
    }
    
    if (!req.body.confirm) {
      workflow.outcome.errfor.confirm = 'required';
    }
    
    if (req.body.newPassword !== req.body.confirm) {
      workflow.outcome.errors.push('Passwords do not match.');
    }
    
    if (workflow.hasErrors()) {
      return workflow.emit('response');
    }
    
    workflow.emit('patchUser');
  });
  
  workflow.on('patchUser', function() {
    var fieldsToSet = {
      password: req.app.db.models.User.encryptPassword(req.body.newPassword)
    };
    
    req.app.db.models.User.findByIdAndUpdate(req.user.id, fieldsToSet, function(err, user) {
      if (err) {
        return workflow.emit('exception', err);
      }
      
      user.populate('roles.admin roles.account', 'name.full', function(err, user) {
        if (err) {
          return workflow.emit('exception', err);
        }
        
        workflow.outcome.user = user;
        workflow.outcome.newPassword = '';
        workflow.outcome.confirm = '';
        workflow.emit('response');
      });
    });
  });
  
  workflow.emit('validate');
};