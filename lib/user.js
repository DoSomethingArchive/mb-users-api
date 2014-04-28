/**
 * Interface to the User model.
 */

/**
 * Constructor to the User object.
 *
 * @param email
 *   The email of the user doc to execute commands on.
 * @param model
 *   The model of the user document.
 */
function User(model) {
  this.docModel = model;
}

/**
 * Finds a user document for a given email.
 *
 * @param req
 *   The request object in a GET callback.
 * @param res
 *   The reponse object in a GET callback.
 */
User.prototype.get = function(req, res) {
  // Store handle to this in self so that it can be accessed within callback.
  var self = this;
  self.response = res;

  var query = {};
  if (req.query.email) {
    query.email = req.query.email;
  }
  else if (req.query.drupal_uid) {
    query.drupal_uid = req.query.drupal_uid;
  }

  self.queryString = JSON.stringify(query);

  this.docModel.findOne(
    query,
    function(err, doc) {
      if (err) {
        self.response.send(500, err);
        console.log(err);
        return;
      }

      // Respond with the user doc if found.
      if (doc) {
        self.response.send(200, doc);
        console.log('GET /user request. Responding with user doc for: ' + doc.email);
      }
      else {
        // Return an empty object if no doc is found.
        self.response.send(204, {});
        console.log('GET /user request. No doc found for query: ' + self.queryString);
      }
    }
  );
};

/**
 * Creates or updates a user document for a given email.
 *
 * @param req
 *  The request object in a POST callback.
 * @param res
 *  The response object in a POST callback.
 */
User.prototype.post = function(req, res) {
  var self = this;
  self.request = req;
  self.response = res;
  self.email = req.body.email;

  this.docModel.findOne(
    {email: self.email},
    function(err, doc) {
      if (err) {
        self.response.send(500, err);
        console.log(err);
        return;
      }

      // Only update the fields that are provided by the request.
      var updateArgs = {};

      if (self.request.body.subscribed !== undefined) {
        updateArgs.subscribed = self.request.body.subscribed;
      }
      else if (doc && doc.subscribed !== undefined) {
        updateArgs.subscribed = doc.subscribed;
      }

      if (self.request.body.drupal_uid !== undefined) {
        updateArgs.drupal_uid = self.request.body.drupal_uid;
      }
      else if (doc && doc.drupal_uid !== undefined) {
        updateArgs.drupal_uid = doc.drupal_uid;
      }

      if (self.request.body.mailchimp_status !== undefined) {
        updateArgs.mailchimp_status = self.request.body.mailchimp_status;
      }
      else if (doc && doc.mailchimp_status !== undefined) {
        updateArgs.mailchimp_status = doc.mailchimp_status;
      }

      if (self.request.body.mobile !== undefined) {
        updateArgs.mobile = self.request.body.mobile;
      }
      else if (doc && doc.mobile !== undefined) {
        updateArgs.mobile = doc.mobile;
      }

      if (self.request.body.drupal_register_timestamp !== undefined) {
        // Convert timestamp string to Date object
        var timestamp = parseInt(self.request.body.drupal_register_timestamp);
        // Date() expects milliseconds
        var drupalRegisterDate = new Date(timestamp * 1000);

        // Structure for anniversary in user model
        updateArgs.drupal_register_date = {
          day: drupalRegisterDate.getDate(),
          month: drupalRegisterDate.getMonth()
        };
        updateArgs.drupal_register_year = drupalRegisterDate.getYear();
      }
      else if (doc && typeof doc.drupal_register_date == 'object' && !isObjectEmpty(doc.drupal_register_date)) {
        updateArgs.drupal_register_date = doc.drupal_register_date;
        updateArgs.drupal_register_year = doc.drupal_register_year;
      }

      if (self.request.body.birthdate_timestamp !== undefined) {
        // Convert timestamp string to Date object
        var timestamp = parseInt(self.request.body.birthdate_timestamp);
        // Date() expects milliseconds
        var birthdate = new Date(timestamp * 1000);

        // Structure for birthdate in user model
        updateArgs.birthdate = {
          day: birthdate.getDate(),
          month: birthdate.getMonth()
        };
        updateArgs.birthdate_year = birthdate.getYear();
      }
      else if (doc && typeof doc.birthdate == 'object' && !isObjectEmpty(doc.birthdate)) {
        updateArgs.birthdate = doc.birthdate;
        updateArgs.birthdate_year = doc.birthdate_year;
      }

      // If there are campaigns to update, we need to handle on our own how
      // that field gets updated in the document.
      if (self.request.body.campaigns !== undefined) {
        if (doc && doc.campaigns !== undefined) {
          // Add old campaigns data to ensure it doesn't get lost.
          updateArgs.campaigns = doc.campaigns;

          // Update old data with any matching data from the request.
          for(var i = 0; i < self.request.body.campaigns.length; i++) {

            var reqCampaign = self.request.body.campaigns[i];
            var matchFound = false;

            for (var j = 0; j < updateArgs.campaigns.length; j++) {

              if (parseInt(reqCampaign.nid) === updateArgs.campaigns[j].nid) {
                // Update only the fields provided by the request.
                if (reqCampaign.signup !== undefined) {
                  updateArgs.campaigns[j].signup = reqCampaign.signup;
                }

                if (reqCampaign.reportback !== undefined) {
                  updateArgs.campaigns[j].reportback = reqCampaign.reportback;
                }

                matchFound = true;
                break;
              }

            }

            // No matching nid. Add to end of the updateArgs.campaigns array.
            if (!matchFound) {
              updateArgs.campaigns[updateArgs.campaigns.length] = reqCampaign;
            }
          }
        }
        else {
          // If no old data to worry about, just update with the request's campaign data.
          updateArgs.campaigns = self.request.body.campaigns;
        }
      }

      // Update the user document.
      self.updateUser(self.email, updateArgs, self.response);
    }
  );
};

/**
 * Updates a user document if it already exists, or upserts one if it doesn't.
 *
 * @param email
 *  Email address of the user document to update/upsert.
 * @param args
 *  Values to update the document with.
 * @param response
 *  Response object to handle responses back to the sender.
 */
User.prototype.updateUser = function(email, args, response) {
  var self = {};
  self.email = email;
  self.args = args;
  self.response = response;

  this.docModel.update(
    { 'email': self.email },
    self.args,
    { upsert: true },
    function(err, num, raw) {
      if (err) {
        self.response.send(500, err);
        console.log(err);
      }

      console.log('Update/upsert executed on: %s. Raw response from mongo:', self.email);
      console.log(raw);

      self.response.send(true);
    }
  );
}

/**
 * Helper function to determine if an object is empty or not.
 *
 * @param obj
 *   The object to check.
 */
var isObjectEmpty = function(obj) {
  for(var key in obj) {
    return true;
  }

  return false;
};

module.exports = User;